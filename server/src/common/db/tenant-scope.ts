import type {
  ClientSession,
  HydratedDocument,
  Model,
  MongooseQueryMiddleware,
  Query,
  QueryFilter,
  Schema,
  Types,
} from "mongoose";

// Tenant isolation in the application layer (tenancy design §3, §6; NFR-ISO-03).
//
// Two layers:
//  1. `tenantScoped` schema plugin — a guard: any query on a tenant-owned collection whose
//     filter lacks `organizationId` throws instead of silently reading every tenant.
//  2. `forTenant(model, orgId)` — the normal way to access tenant data: it adds
//     `organizationId` to every filter and to every created document.
//
// The only escape hatch is an explicit, greppable `{ tenantScope: "bypass" }` query option,
// for legitimate cross-tenant reads (e.g. "my memberships in all organizations").

declare module "mongoose" {
  interface QueryOptions {
    tenantScope?: "bypass";
  }
}

export class TenantScopeError extends Error {
  constructor(model: string, op: string) {
    super(`Unscoped ${op} on tenant collection "${model}": filter must include organizationId`);
    this.name = "TenantScopeError";
  }
}

const QUERY_OPS: MongooseQueryMiddleware[] = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

export function tenantScoped(schema: Schema): void {
  schema.pre(QUERY_OPS, function (this: Query<unknown, unknown>) {
    if (this.getOptions().tenantScope === "bypass") return;
    if (this.getFilter().organizationId == null) {
      throw new TenantScopeError(this.model.modelName, (this as { op?: string }).op ?? "query");
    }
  });

  schema.pre("aggregate", function () {
    if (this.options.tenantScope === "bypass") return;
    const first = this.pipeline()[0] as { $match?: { organizationId?: unknown } } | undefined;
    if (first?.$match?.organizationId == null) {
      throw new TenantScopeError(this.model().modelName, "aggregate");
    }
  });
}

type OrgId = Types.ObjectId | string;

// Repository for one organization's slice of a tenant-owned collection.
export function forTenant<T extends { organizationId: Types.ObjectId }>(
  model: Model<T>,
  organizationId: OrgId,
) {
  if (!organizationId) throw new Error(`forTenant(${model.modelName}) needs an organizationId`);

  const scoped = (filter: QueryFilter<T> = {}): QueryFilter<T> =>
    ({ ...filter, organizationId }) as QueryFilter<T>;

  return {
    find: (filter?: QueryFilter<T>) => model.find(scoped(filter)),
    findOne: (filter?: QueryFilter<T>) => model.findOne(scoped(filter)),
    // A valid ID from another tenant is simply "not found" (tenancy design §6).
    findById: (id: OrgId) => model.findOne(scoped({ _id: id } as QueryFilter<T>)),
    countDocuments: (filter?: QueryFilter<T>) => model.countDocuments(scoped(filter)),
    exists: (filter?: QueryFilter<T>) => model.exists(scoped(filter)),
    updateOne: (filter: QueryFilter<T>, update: object, session?: ClientSession) =>
      model.updateOne(scoped(filter), update, { session }),
    deleteOne: (filter: QueryFilter<T>, session?: ClientSession) =>
      model.deleteOne(scoped(filter), { session }),
    // organizationId always comes from the request context, never the body (tenancy §6).
    create: async (
      doc: Omit<T, "organizationId" | "createdAt" | "updatedAt">,
      session?: ClientSession,
    ) => {
      // Mongoose's create() overloads do not compose with a generic T; the shape is checked by the schema.
      const createMany = model.create.bind(model) as unknown as (
        docs: object[],
        options: { session?: ClientSession },
      ) => Promise<HydratedDocument<T>[]>;
      const [created] = await createMany([{ ...doc, organizationId }], { session });
      return created!;
    },
  };
}
