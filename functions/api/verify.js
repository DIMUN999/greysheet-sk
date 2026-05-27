export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { ADMIN_PASSWORD } = env;

    // Verify environment variables are set
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Server is missing environment variables." }), { status: 500 });
    }

    // Parse the request body
    const body = await request.json();
    const { password } = body;

    // Verify the password
    if (password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized. Invalid password." }), { status: 401 });
    }

    return new Response(JSON.stringify({ success: true, message: "Password verified." }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal Server Error." }), { status: 500 });
  }
}
