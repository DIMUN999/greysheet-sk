export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { CMS_PASSWORD, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;

    // 1. Verify environment variables are set
    if (!CMS_PASSWORD || !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return new Response(JSON.stringify({ error: "Server is missing environment variables." }), { status: 500 });
    }

    // 2. Parse the request body
    const body = await request.json();
    const { password, path, content } = body;

    // 3. Verify the password
    if (password !== CMS_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized. Invalid password." }), { status: 401 });
    }

    // Ensure path doesn't start with a slash for the GitHub API
    const safePath = path.startsWith('/') ? path.slice(1) : path;
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${safePath}`;

    // 4. Get the current file's SHA (required by GitHub API to update a file)
    const getRes = await fetch(githubApiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "Cloudflare-CMS-Worker",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!getRes.ok && getRes.status !== 404) {
      return new Response(JSON.stringify({ error: "Failed to fetch file from GitHub." }), { status: 500 });
    }

    let sha = undefined;
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }

    // 5. Encode the new content to Base64
    // Use TextEncoder to correctly handle UTF-8 characters before base64 encoding
    const encodedContent = btoa(String.fromCharCode.apply(null, new Uint8Array(new TextEncoder().encode(content))));

    // 6. Push the update to GitHub
    const putRes = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "Cloudflare-CMS-Worker",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `CMS Update: Modified ${safePath}`,
        content: encodedContent,
        sha: sha // This will be undefined if the file is new, which is fine
      })
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      console.error("GitHub API Error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to push to GitHub." }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: "File saved successfully." }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal Server Error." }), { status: 500 });
  }
}
