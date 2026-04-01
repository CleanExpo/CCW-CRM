import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["www.ccwonline.com.au", "ccwonline.com.au"]);

function extractSummary(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines.filter((line) => {
    if (line.startsWith("#")) return false;
    if (line.startsWith("![")) return false;
    if (line.startsWith("http")) return false;
    return true;
  });

  const summary = filtered.slice(0, 3).join(" ");
  return summary.length > 400 ? `${summary.slice(0, 397)}...` : summary;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");

  if (!urlParam) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return NextResponse.json({ error: "URL host not allowed" }, { status: 400 });
  }

  const baseUrl = process.env.JINA_READER_BASE_URL || "https://r.jina.ai/http://";
  const apiKey = process.env.JINA_API_KEY;
  const headers: HeadersInit = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`${baseUrl}${targetUrl.toString()}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch summary from Jina" },
        { status: 502 }
      );
    }

    const text = await response.text();
    const summary = extractSummary(text);

    return NextResponse.json({
      summary,
      source: "jina",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load summary" },
      { status: 500 }
    );
  }
}
