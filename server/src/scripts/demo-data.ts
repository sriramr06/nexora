import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../app";
import { logger } from "../common/logger";
import { signAccessToken } from "../modules/auth/access-token";
import { hashPassword } from "../modules/auth/password";
import { setEmailService } from "../modules/email/email.service";
import { MembershipModel } from "../modules/members/membership.model";
import { UserModel } from "../modules/users/user.model";

// Demo data for walkthroughs, screenshots and the end-to-end tests.
// Used by `npm run db:seed:demo` (seed-demo.ts) and the e2e stack.
//
// Everything except the people and their memberships goes through the real API
// (in-process), so every rule, history entry and notification is exactly what the
// app itself would produce. No emails are sent. Run `npm run db:seed` first (Owner).

export const DEMO_PASSWORD = "Demo1234";
const DOMAIN = "acme.example"; // .example is reserved: these addresses can never receive mail

const PEOPLE = {
  priya: { name: "Priya Sharma", email: `priya@${DOMAIN}` }, // Tenant Admin
  arun: { name: "Arun Kumar", email: `arun@${DOMAIN}` }, // Project Manager
  divya: { name: "Divya Menon", email: `divya@${DOMAIN}` }, // Project Manager
  meena: { name: "Meena Iyer", email: `meena@${DOMAIN}` }, // Team Member
  kiran: { name: "Kiran Rao", email: `kiran@${DOMAIN}` }, // Team Member
  sam: { name: "Sam Patel", email: "sam@globex.example" }, // registers a second, pending org
} as const;
type Person = keyof typeof PEOPLE;

type Status = "todo" | "in_progress" | "in_review" | "done";
interface TaskPlan {
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  due?: number; // days from today; negative = overdue
  assignee?: Person;
  status?: Status;
  blocked?: string;
  onHold?: string;
  changesRequested?: string; // sent back once before its current status
  comments?: [Person, string][];
}

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Returns false when the demo data is already there.
export async function seedDemo({
  sendEmails = false,
}: { sendEmails?: boolean } = {}): Promise<boolean> {
  if (!sendEmails) setEmailService({ send: async () => undefined }); // demo addresses are fake
  const app = createApp();

  if (await UserModel.exists({ email: PEOPLE.priya.email })) {
    return false;
  }
  const owner = await UserModel.findOne({ platformRole: "owner" });
  if (!owner) throw new Error("No Application Owner yet. Run `npm run db:seed` first.");

  // ---------- people (verified accounts, shared demo password)
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = {} as Record<Person, { _id: Types.ObjectId; id: string }>;
  for (const [key, p] of Object.entries(PEOPLE) as [Person, (typeof PEOPLE)[Person]][]) {
    users[key] = await UserModel.create({ ...p, passwordHash, emailVerified: true });
  }

  const api = (who: Person | "owner") => {
    const token = signAccessToken(who === "owner" ? owner.id : users[who].id);
    const call = async (method: "get" | "post" | "put" | "patch", path: string, body?: object) => {
      const res = await request(app)
        [method](`/api/v1${path}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
      if (res.status >= 400) {
        throw new Error(`${who} ${method.toUpperCase()} ${path} → ${res.status} ${res.text}`);
      }
      return res.body.data;
    };
    return call;
  };

  // ---------- organizations: Acme (active), Globex (pending, for the Owner's queue)
  const details = {
    type: "product",
    size: "11-50",
    industry: "software_product",
    country: "IN",
    timezone: "Asia/Kolkata",
  };
  const acme = (
    await api("priya")("post", "/orgs", {
      name: "Acme Corp",
      website: "https://acme.example",
      description: "Product studio building web and mobile apps for retail brands.",
      ...details,
    })
  ).organization;
  await api("owner")("post", `/platform/organizations/${acme.id}/approve`);
  await api("sam")("post", "/orgs", { name: "Globex Labs", ...details, size: "1-10" });

  const org = `/orgs/${acme.id}`;
  for (const [who, role] of [
    ["arun", "project_manager"],
    ["divya", "project_manager"],
    ["meena", "member"],
    ["kiran", "member"],
  ] as const) {
    await MembershipModel.create({
      organizationId: new Types.ObjectId(acme.id),
      userId: users[who]._id,
      role,
    });
  }
  await api("priya")("post", `${org}/invitations`, { email: `neha@${DOMAIN}`, role: "member" });

  // ---------- projects and tasks
  const plans: {
    manager: Person;
    name: string;
    description: string;
    members: Person[];
    tasks: TaskPlan[];
  }[] = [
    {
      manager: "arun",
      name: "Website relaunch",
      description: "New marketing site with a faster checkout and a refreshed brand.",
      members: ["meena", "kiran"],
      tasks: [
        {
          title: "Finalize homepage wireframes",
          priority: "high",
          due: -8,
          assignee: "meena",
          status: "done",
          comments: [["arun", "Approved — matches the brand guide."]],
        },
        {
          title: "Set up CI for the site repo",
          priority: "medium",
          due: -5,
          assignee: "kiran",
          status: "done",
        },
        {
          title: "Design product listing page",
          priority: "high",
          due: 3,
          assignee: "meena",
          status: "in_review",
          comments: [
            ["meena", "Ready for review. Filters are in the left rail."],
            ["arun", "Looking at it this afternoon."],
          ],
        },
        {
          title: "Checkout flow redesign",
          priority: "urgent",
          due: 5,
          assignee: "meena",
          status: "in_progress",
          changesRequested: "Add the guest checkout option before the payment step.",
        },
        {
          title: "Integrate payment gateway",
          priority: "urgent",
          due: -2,
          assignee: "kiran",
          status: "in_progress",
          blocked: "Waiting for the gateway sandbox keys from finance.",
          comments: [["kiran", "Raised a ticket with finance on Monday."]],
        },
        {
          title: "Write SEO meta descriptions",
          priority: "low",
          due: 12,
          assignee: "kiran",
          status: "todo",
        },
        {
          title: "Accessibility audit",
          priority: "medium",
          due: 9,
          assignee: "meena",
          status: "todo",
        },
        {
          title: "Migrate blog posts",
          priority: "low",
          due: -1,
          assignee: "kiran",
          status: "todo",
        },
        { title: "Cookie consent banner", priority: "medium", due: 14, status: "todo" },
        {
          title: "Performance budget",
          priority: "medium",
          due: 20,
          assignee: "kiran",
          status: "todo",
          onHold: "Parked until the new CDN contract is signed.",
        },
        {
          title: "Analytics events plan",
          priority: "high",
          due: 6,
          assignee: "meena",
          status: "in_progress",
        },
        { title: "Launch checklist", priority: "high", due: 25, status: "todo" },
      ],
    },
    {
      manager: "divya",
      name: "Mobile app v2",
      description: "Offline-first rewrite of the shopping app with push notifications.",
      members: ["meena", "kiran"],
      tasks: [
        {
          title: "Offline sync spike",
          priority: "high",
          due: -10,
          assignee: "kiran",
          status: "done",
        },
        {
          title: "Push notification service",
          priority: "urgent",
          due: 4,
          assignee: "kiran",
          status: "in_review",
        },
        {
          title: "Onboarding screens",
          priority: "medium",
          due: 7,
          assignee: "meena",
          status: "in_progress",
          comments: [["divya", "Please reuse the illustrations from the web refresh."]],
        },
        {
          title: "App store screenshots",
          priority: "low",
          due: 30,
          assignee: "meena",
          status: "todo",
        },
        {
          title: "Crash reporting setup",
          priority: "high",
          due: -3,
          assignee: "kiran",
          status: "todo",
        },
        {
          title: "Dark mode support",
          priority: "medium",
          due: 15,
          assignee: "meena",
          status: "todo",
        },
        {
          title: "Beta tester recruitment",
          priority: "medium",
          due: 10,
          status: "todo",
          blocked: "Legal is still reviewing the beta agreement.",
        },
        {
          title: "Release notes template",
          priority: "low",
          due: 18,
          assignee: "meena",
          status: "done",
        },
      ],
    },
    {
      manager: "arun",
      name: "Customer support portal",
      description: "Self-service help centre with ticket tracking.",
      members: ["kiran"],
      tasks: [
        {
          title: "Choose help-centre platform",
          priority: "high",
          due: -6,
          assignee: "kiran",
          status: "done",
        },
        {
          title: "Import top 50 FAQs",
          priority: "medium",
          due: 8,
          assignee: "kiran",
          status: "in_progress",
        },
        { title: "Ticket form fields", priority: "medium", due: 11, status: "todo" },
      ],
    },
  ];

  let taskCount = 0;
  for (const plan of plans) {
    const project = await api(plan.manager)("post", `${org}/projects`, {
      name: plan.name,
      description: plan.description,
    });
    await api(plan.manager)("post", `${org}/projects/${project.id}/members`, {
      userIds: plan.members.map((m) => users[m].id),
    });

    for (const t of plan.tasks) {
      const manager = api(plan.manager);
      let task = await manager("post", `${org}/projects/${project.id}/tasks`, {
        title: t.title,
        priority: t.priority ?? "medium",
        ...(t.due !== undefined ? { dueDate: day(t.due) } : {}),
        assigneeId: t.assignee ? users[t.assignee].id : null,
      });
      const worker = t.assignee ? api(t.assignee) : manager;
      const move = async (who: typeof manager, status: Status) => {
        task = await who("post", `${org}/tasks/${task.id}/status`, {
          status,
          version: task.version,
        });
      };

      // Walk the review workflow (R14) to the target status.
      const target = t.status ?? "todo";
      if (target !== "todo") await move(worker, "in_progress");
      if (t.changesRequested) {
        await move(worker, "in_review");
        task = await manager("post", `${org}/tasks/${task.id}/request-changes`, {
          reason: t.changesRequested,
          version: task.version,
        });
      }
      if (target === "in_review" || target === "done") await move(worker, "in_review");
      if (target === "done") await move(manager, "done");

      if (t.blocked) {
        task = await worker("put", `${org}/tasks/${task.id}/flag`, {
          type: "blocked",
          reason: t.blocked,
          version: task.version,
        });
      }
      if (t.onHold) {
        task = await manager("put", `${org}/tasks/${task.id}/flag`, {
          type: "on_hold",
          reason: t.onHold,
          version: task.version,
        });
      }
      for (const [who, body] of t.comments ?? []) {
        await api(who)("post", `${org}/tasks/${task.id}/comments`, { body });
      }
      taskCount += 1;
    }
  }

  logger.info(
    {
      organization: "Acme Corp",
      projects: plans.length,
      tasks: taskCount,
      password: DEMO_PASSWORD,
    },
    `Demo data ready. Log in as ${PEOPLE.priya.email} (admin), ${PEOPLE.arun.email} (manager) or ${PEOPLE.meena.email} (member).`,
  );
  return true;
}
