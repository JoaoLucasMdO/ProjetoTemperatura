import { BluetoothSerialPort } from "bluetooth-serial-port";
import axios from "axios";
import open from "open";
import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import path from "path";
import serviceAccount from "./path/to/temperaturahumidade-firebase-adminsdk-h8zuy-c08c9e58c3.json" assert { type: "json" };


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "temperaturahumidade",
});

// Conexão com o Firestore
const db = admin.firestore();

// Configuração do servidor Express
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

// Função para buscar os dados do Firestore
async function obterDadosDoFirestore() {
  const snapshot = await db
    .collection("readings")
    .orderBy("timestamp", "asc")
    .get();
  const dados = snapshot.docs.map((doc) => doc.data());
  return dados;
}

// Função para gerar o gráfico
async function gerarGrafico() {
  const largura = 800;
  const altura = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: largura,
    height: altura,
  });

  const dados = await obterDadosDoFirestore();

  const labels = dados.map((dado) => dado.timestamp.toDate().toLocaleString());
  const temperaturas = dados.map((dado) => dado.temperatura);
  const humidades = dados.map((dado) => dado.humidade);

  const configuracao = {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Temperatura (°C)",
          data: temperaturas,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderWidth: 1,
        },
        {
          label: "Umidade (%)",
          data: humidades,
          borderColor: "rgba(54, 162, 235, 1)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  const imagemBuffer = await chartJSNodeCanvas.renderToBuffer(configuracao);
  return imagemBuffer;
}

// Rota para salvar dados no Firestore
app.post("/sendData", async (req, res) => {
  try {
    const { data } = req.body;
    console.log("Dados recebidos:", data);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).send("Dados inválidos");
    }

    const docRef = db.collection("readings").doc();
    await docRef.set(
      {
        temperatura: data[0].data1,
        humidade: data[0].data2,
        timestamp: new Date(),
      },
      { merge: true }
    );

    console.log("Dados salvos com sucesso no Firestore");
    res.status(200).send("Data saved successfully!");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    res.status(500).send("Error saving data");
  }
});

// Rota para gerar e servir o gráfico
app.get("/grafico.png", async (req, res) => {
  try {
    const imagem = await gerarGrafico();
    res.setHeader("Content-Type", "image/png");
    res.send(imagem);
  } catch (error) {
    console.error("Erro ao gerar gráfico:", error);
    res.status(500).send("Error generating graph");
  }
});

// Rota para exibir a página do gráfico
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciando o servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Configuração do Bluetooth
const btSerialPort = new BluetoothSerialPort();
const hc05Address = "98:D3:31:F9:3F:35"; // Endereço do HC-05
const apiUrl = "http://localhost:3000/sendData";

let buffer = ""; // Buffer temporário para os dados

// Abre o gráfico no navegador na inicialização
(async () => {
  await open("http://localhost:3000/");
  console.log("Gráfico aberto no navegador.");
})();

// Tente conectar ao HC-05
btSerialPort.connect(hc05Address, 1, (err, status) => {
  if (err) {
    console.error("Erro ao conectar:", err);
    return;
  }

  console.log("Conectado ao HC-05");

  // Quando receber dados
  btSerialPort.on("data", (data) => {
    const receivedData = data.toString("utf-8").trim();
    console.log("Dados recebidos:", receivedData);

    buffer += receivedData; // Adiciona os dados ao buffer

    // Verifique se temos um JSON completo no buffer
    if (buffer.startsWith("{") && buffer.endsWith("}")) {
      try {
        const jsonData = JSON.parse(buffer);
        sendData(jsonData);
        buffer = ""; // Limpa o buffer após o envio bem-sucedido
      } catch (e) {
        console.log("Erro ao analisar JSON:", e.message);
        // Se falhar, continue acumulando no buffer
      }
    } else {
      console.log("Aguardando dados completos...");
    }
  });

  // Função para enviar dados
  async function sendData(jsonData) {
    try {
      const response = await axios.post(apiUrl, { data: jsonData });
      console.log(
        `Resposta da API: ${response.status} - ${response.statusText}`
      );
    } catch (error) {
      console.error(`Erro ao enviar dados para a API: ${error.message}`);
    }
  }

  // Tratamento de erros
  btSerialPort.on("error", (error) => {
    console.error("Erro:", error);
  });
});

// Desconectando
process.on("SIGINT", () => {
  btSerialPort.close();
  console.log("Conexão encerrada.");
  process.exit();
});
