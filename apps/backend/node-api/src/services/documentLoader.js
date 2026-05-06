import fs from "fs";
import path from "path";

function parseMetadataAndBody(raw) {
  const lines = raw.split(/\r?\n/);
  const metadata = { title: "", source: "", url: "", topic: "" };

  let bodyStartIndex = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      bodyStartIndex = i + 1;
      break;
    }

    const match = line.match(/^(Title|Source|URL|Topic)\s*:\s*(.*)$/i);
    if (!match) {
      bodyStartIndex = i;
      break;
    }

    const key = match[1].toLowerCase();
    const value = (match[2] || "").trim();
    if (key === "title") metadata.title = value;
    if (key === "source") metadata.source = value;
    if (key === "url") metadata.url = value;
    if (key === "topic") metadata.topic = value;
    bodyStartIndex = i + 1;
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();
  return { metadata, body };
}

export function loadLegalDocuments(legalDocsDir) {
  if (!fs.existsSync(legalDocsDir)) {
    return { documents: [], warning: `Dataset folder not found: ${legalDocsDir}` };
  }

  const entries = fs.readdirSync(legalDocsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === ".txt");

  const documents = files.map((file) => {
    const filePath = path.join(legalDocsDir, file.name);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { metadata, body } = parseMetadataAndBody(raw);

    return {
      id: file.name,
      fileName: file.name,
      metadata: {
        title: metadata.title || file.name,
        source: metadata.source || "Unknown source",
        url: metadata.url || "",
        topic: metadata.topic || "General"
      },
      text: body
    };
  });

  return { documents, warning: null };
}
