const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Permite que qualquer site/app acesse sua API
app.use(express.json());

// --- CONFIGURAÇÕES FIXAS (IDENTIDADE ALEX DANTAS) ---
const PIX_CONFIG = {
    key: "07131508403",
    name: "ALEX DA SILVA DANTAS",
    city: "MARACANAU",
    // Parte fixa dos metadados do seu app (br.gov.bcb.brcode...)
    // Retirado do final do campo 62 do seu código original
    appMetadata: "50300017br.gov.bcb.brcode01051.0.0" 
};

/**
 * Rota GET para gerar o PIX
 * Exemplo de uso: /api/pix?valor=15.50&txid=PEDIDO123
 */
app.get('/api/pix', (req, res) => {
    try {
        let { valor, txid } = req.query;

        if (!valor) {
            return res.status(400).json({ error: 'O parametro "valor" é obrigatorio.' });
        }

        // Formata o valor (ex: 15.5 -> 15.50)
        const amount = parseFloat(valor).toFixed(2);

        // Se não enviar txid, gera um aleatório baseado em data para ser único
        // O TxID deve ter até 25 caracteres e sem caracteres especiais
        if (!txid) {
            txid = "ALX" + Date.now().toString().slice(-10); 
        }

        // Limpa o txid para garantir compatibilidade
        txid = txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25).toUpperCase();

        // Gera o Payload
        const payload = generatePixPayload(amount, txid);

        // Retorna JSON para o App
        return res.json({
            success: true,
            merchant: PIX_CONFIG.name,
            amount: amount,
            txid: txid,
            payload_pix: payload, // O código Copia e Cola
            qr_code_url: `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=300&ecLevel=M`
        });

    } catch (error) {
        return res.status(500).json({ error: 'Erro ao gerar PIX' });
    }
});

// --- FUNÇÕES DE CÁLCULO (ENGINE) ---

function generatePixPayload(amount, txid) {
    const { key, name, city, appMetadata } = PIX_CONFIG;

    // 1. Campos Básicos
    const header = "000201";
    const accountInfo = formatField("26", 
        formatField("00", "br.gov.bcb.pix") + 
        formatField("01", key)
    );
    const category = formatField("52", "0000");
    const currency = formatField("53", "986");
    const amountField = formatField("54", amount);
    const country = formatField("58", "BR");
    const nameField = formatField("59", name);
    const cityField = formatField("60", city);

    // 2. Campo 62 (Metadados + TxID)
    // Estrutura: [05 + Len + TxID] + [50 + Len + AppMetadata]
    const txidField = formatField("05", txid);
    // Nota: appMetadata já veio formatado do seu código original como (5030...)
    // mas se precisarmos remontar, seria formatField("50", "0017br.gov.bcb.brcode01051.0.0")
    // Como no config eu coloquei o bloco inteiro "5030...", apenas concatenamos.
    
    const field62 = formatField("62", txidField + appMetadata);

    // 3. Monta string parcial
    let rawPix = header + accountInfo + category + currency + amountField + country + nameField + cityField + field62;

    // 4. Adiciona sufixo do CRC
    rawPix += "6304";

    // 5. Calcula CRC e anexa
    const crc = getCRC16(rawPix);
    return rawPix + crc;
}

function formatField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

function getCRC16(payload) {
    let polinomio = 0x1021;
    let crc = 0xFFFF;

    for (let i = 0; i < payload.length; i++) {
        crc ^= (payload.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) != 0) {
                crc = (crc << 1) ^ polinomio;
            } else {
                crc = (crc << 1);
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Iniciar Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Alex Dantas PIX rodando na porta ${PORT}`);
    console.log(`Teste local: http://localhost:${PORT}/api/pix?valor=10.00`);
});
