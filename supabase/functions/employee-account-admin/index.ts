import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://tibaldo-app-private-beta.pages.dev",
  "https://employee-hotfix-qa.tibaldo-app-private-beta.pages.dev",
  "https://owner-team-v2-qa.tibaldo-app-private-beta.pages.dev",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://tibaldo-app-private-beta.pages.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = cors(origin);
  if (origin && !allowedOrigins.has(origin)) return Response.json({ error: "origin_denied" }, { status: 403, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return Response.json({ error: "method_denied" }, { status: 405, headers });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("authentication_required");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("authentication_required");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const { data: ownerMembership, error: membershipLookupError } = await userClient.from("tibaldo_app_memberships")
      .select("role").eq("user_id", authData.user.id).eq("role", "OWNER").maybeSingle();
    if (membershipLookupError || !ownerMembership) throw new Error("owner_required");

    const body = await request.json() as {
      action?: "status" | "invite" | "disable" | "recovery";
      personId?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    if (!body.action || !body.personId || !["status", "invite", "disable", "recovery"].includes(body.action)) {
      throw new Error("invalid_request");
    }

    const { data: profile, error: profileError } = await userClient.from("tibaldo_app_employee_profiles")
      .select("id,user_id,display_name,staff_key,active,status")
      .eq("id", body.personId)
      .in("staff_key", ["gaelle", "jennifer", "rachida"])
      .single();
    if (profileError || !profile) throw new Error("employee_not_found");

    if (body.action === "status") {
      if (!profile.user_id) return Response.json({ ok: true, state: "ACCOUNT_NOT_CREATED" }, { headers });
      const { data } = await admin.auth.admin.getUserById(profile.user_id);
      const user = data.user;
      const disabled = !profile.active || profile.status === "DISABLED"
        || Boolean(user?.banned_until && new Date(user.banned_until) > new Date());
      return Response.json({
        ok: true,
        state: disabled ? "DISABLED" : (user?.last_sign_in_at ? "ACTIVE" : "INVITED"),
      }, { headers });
    }

    if (body.action === "invite") {
      if (profile.user_id) throw new Error("account_already_exists");
      const email = String(body.email || "").trim().toLowerCase();
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      if (!email || !firstName || !lastName) throw new Error("identity_fields_required");
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://tibaldo-app-private-beta.pages.dev/equipe/reinitialiser",
        data: { first_name: firstName, last_name: lastName, account_source: "owner_employee_invite" },
      });
      if (inviteError || !invited.user) throw inviteError || new Error("invite_failed");
      const { error: linkError } = await userClient.from("tibaldo_app_employee_profiles")
        .update({ user_id: invited.user.id, active: true, status: "ACTIVE", updated_at: new Date().toISOString() })
        .eq("id", profile.id).is("user_id", null);
      if (linkError) throw linkError;
      const { error: membershipError } = await userClient.from("tibaldo_app_memberships")
        .upsert({ user_id: invited.user.id, role: "EMPLOYEE", updated_at: new Date().toISOString() });
      if (membershipError) throw membershipError;
      return Response.json({ ok: true, state: "INVITED" }, { headers });
    }

    if (!profile.user_id) throw new Error("account_not_created");
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
    if (userError || !userData.user?.email) throw new Error("auth_user_not_found");

    if (body.action === "disable") {
      const { error: disableError } = await admin.auth.admin.updateUserById(profile.user_id, { ban_duration: "876000h" });
      if (disableError) throw disableError;
      const { error: profileUpdateError } = await userClient.from("tibaldo_app_employee_profiles")
        .update({ active: false, status: "DISABLED", updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (profileUpdateError) throw profileUpdateError;
      return Response.json({ ok: true, state: "DISABLED" }, { headers });
    }

    const { error: recoveryError } = await admin.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: "https://tibaldo-app-private-beta.pages.dev/equipe/reinitialiser",
    });
    if (recoveryError) throw recoveryError;
    return Response.json({ ok: true, state: "RECOVERY_SENT" }, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unknown_error" },
      { status: 400, headers },
    );
  }
});
