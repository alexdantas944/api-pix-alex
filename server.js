const express = require("express");
const cors = require("cors");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const PIX_CONFIG = {
  key: process.env.PIX_KEY || "07131508403",
  name: process.env.PIX_NAME || "ALEX DA SILVA DANTAS",
  city: process.env.PIX_CITY || "FORTALEZA"
};

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start
    }));
  });
  next();
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    service: "API PIX Alex Dantas",
    version: "2.0.0",
    status: "online",
    endpoints: {
      health: "/health",
      ready: "/ready",
      pix: "/api/pix?valor=10.00&txid=PEDIDO123"
    }
  });
});

// Endpoint leve para o health check do Render.
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "api-pix-alex",
    version: "2.0.0",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Readiness separado do health check.
app.get("/ready", (_req, res) => {
  res.status(200).json({
    success: true,
    ready: true,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/pix", (req, res) => {
  try {
    const amount = parseAmount(req.query.valor);
    if (amount === null) {
      return res.status(400).json({
        success: false,
        error: 'O parâmetro "valor" é obrigatório e deve ser um número maior que zero.'
      });
    }

    if (amount > 99999999.99) {
      return res.status(400).json({
        success: false,
        error: "Valor máximo permitido: R$ 99.999.999,99."
      });
    }

    let txid = sanitizeTxid(req.query.txid);
    if (!txid) {
      txid = `ALX${Date.now().toString().slice(-10)}`;
    }

    const payload = generatePixPayload(amount.toFixed(2), txid);
    const crc = payload.slice(-4);

    return res.json({
      success: true,
      api_version: "2.0.0",
      merchant: PIX_CONFIG.name,
      city: PIX_CONFIG.city,
      pix_key: PIX_CONFIG.key,
      amount: amount.toFixed(2),
      txid,
      payload_pix: payload,
      crc16: crc,
      qr_code_url:
        `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=300&ecLevel=M`
    });
  } catch (error) {
    console.error("PIX generation error:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao gerar PIX."
    });
  }
});

// Permite validar um payload gerado pela própria API.
app.get("/api/pix/validate", (req, res) => {
  const payload = String(req.query.payload || "").trim();

  if (!payload) {
    return res.status(400).json({
      success: false,
      valid: false,
      error: 'Informe "payload".'
    });
  }

  const result = validatePixPayload(payload);

  return res.status(result.valid ? 200 : 400).json({
    success: result.valid,
    valid: result.valid,
    crc16: result.crc16 || null,
    calculated_crc16: result.calculated_crc16 || null,
    error: result.error || null
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada."
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor."
  });
});

function parseAmount(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) return null;

  return number;
}

function sanitizeTxid(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 25);
}

function formatField(id, value) {
  const text = String(value);
  if (text.length > 99) {
    throw new Error(`Campo ${id} excede 99 caracteres.`);
  }
  return `${id}${String(text.length).padStart(2, "0")}${text}`;
}

function generatePixPayload(amount, txid) {
  const merchantAccount =
    formatField("00", "br.gov.bcb.pix") +
    formatField("01", PIX_CONFIG.key);

  const payload =
    "000201" +
    formatField("26", merchantAccount) +
    formatField("52", "0000") +
    formatField("53", "986") +
    formatField("54", amount) +
    formatField("58", "BR") +
    formatField("59", PIX_CONFIG.name) +
    formatField("60", PIX_CONFIG.city) +
    formatField("62", formatField("05", txid)) +
    "6304";

  return payload + getCRC16(payload);
}

function getCRC16(payload) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ 0x1021)
        : (crc << 1);

      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function validatePixPayload(payload) {
  if (!/^[0-9A-Za-z]+$/.test(payload)) {
    return { valid: false, error: "Payload contém caracteres inválidos." };
  }

  if (payload.length < 10 || !payload.endsWith(payload.slice(-4))) {
    return { valid: false, error: "Payload inválido." };
  }

  const crcPosition = payload.length - 4;
  const beforeCrc = payload.slice(0, crcPosition);

  if (beforeCrc.slice(-4) !== "6304") {
    return { valid: false, error: "Campo CRC 6304 não encontrado na posição correta." };
  }

  const provided = payload.slice(crcPosition);
  const calculated = getCRC16(beforeCrc);

  return {
    valid: provided === calculated,
    crc16: provided,
    calculated_crc16: calculated,
    error: provided === calculated ? null : "CRC16 inválido."
  };
}

const server = app.listen(PORT, HOST, () => {
  console.log(`API PIX Alex Dantas v2.0.0`);
  console.log(`Listening on ${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando servidor...`);
  server.close(() => {
    console.log("Servidor encerrado com segurança.");
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});
