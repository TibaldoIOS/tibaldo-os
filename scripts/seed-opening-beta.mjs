import { OPENING_PLAN } from "../src/privateModules/openingPlan.js";

const sql = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;

process.stdout.write("\\set ON_ERROR_STOP on\n");
process.stdout.write("begin;\n");
process.stdout.write("select id as owner_id from auth.users where lower(email)=lower(:'owner_email') limit 1 \\gset\n");
process.stdout.write("insert into public.tibaldo_app_memberships(user_id,role) values (:'owner_id'::uuid,'OWNER') on conflict(user_id) do update set role='OWNER',updated_at=now();\n");

for (const [index, item] of OPENING_PLAN.entries()) {
  process.stdout.write(`insert into public.tibaldo_app_opening_tasks(
    owner_user_id,seed_key,title,description,due_date,week_label,category,priority,status,effort,sort_order
  ) values (
    :'owner_id'::uuid,${sql(item.seed_key)},${sql(item.title)},${sql(item.description)},${sql(item.due_date)},
    ${sql(item.week_label)},${sql(item.category)},${sql(item.priority)},${sql(item.status)},${sql(item.effort)},${index}
  ) on conflict(owner_user_id,seed_key) do nothing;\n`);
}

process.stdout.write("commit;\n");
