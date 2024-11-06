const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const path = require("path");

// Configuração do Firebase Admin SDK
const serviceAccount = require("./path/to/temperaturahumidade-firebase-adminsdk-h8zuy-a57fffe6d9.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "temperaturahumidade",
});

// Conexão com o Firestore
const db = admin.firestore();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static("public")); // Para servir arquivos estáticos como HTML e JS

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

// Rota para salvar dados enviados no Firestore
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
