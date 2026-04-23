const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = process.env.OWNER_ID;
const userEmail = process.env.USER_EMAIL;

if (!supabaseUrl || !serviceRoleKey || !ownerId || !userEmail) {
  console.error(
    "Missing one or more required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID, USER_EMAIL",
  );
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};

const getAllUsers = async () => {
  const users = [];
  let page = 1;

  while (true) {
    const url = new URL("/auth/v1/admin/users", supabaseUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed loading users (${response.status}): ${text}`);
    }

    const payload = await response.json();
    const pageUsers = payload.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < 100) {
      break;
    }
    page += 1;
  }

  return users;
};

const main = async () => {
  const users = await getAllUsers();
  const target = users.find(
    (user) =>
      typeof user.email === "string" &&
      user.email.toLowerCase() === userEmail.toLowerCase(),
  );

  if (!target?.id) {
    throw new Error(`No auth user found for ${userEmail}`);
  }

  const patchUrl = new URL("/rest/v1/planner_profiles", supabaseUrl);
  patchUrl.searchParams.set("owner_id", `eq.${ownerId}`);
  patchUrl.searchParams.set("select", "owner_id,auth_user_id");

  const patchResponse = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      auth_user_id: target.id,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!patchResponse.ok) {
    const text = await patchResponse.text();
    throw new Error(`Failed updating planner_profiles (${patchResponse.status}): ${text}`);
  }

  const updated = await patchResponse.json();
  if (!Array.isArray(updated) || updated.length === 0) {
    throw new Error(`Owner profile ${ownerId} was not found`);
  }

  console.log(
    JSON.stringify(
      {
        ownerId,
        linkedEmail: userEmail,
        authUserId: target.id,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
