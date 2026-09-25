const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "lobo123";
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
const db = new Database(path.join(__dirname, "data", "lobo.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, number TEXT UNIQUE, created_at INTEGER NOT NULL,
 status TEXT NOT NULL, customer TEXT NOT NULL, address TEXT NOT NULL,
 payment TEXT NOT NULL, items TEXT NOT NULL, subtotal REAL NOT NULL,
 delivery_fee REAL NOT NULL, total REAL NOT NULL, notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY, value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key,value) VALUES
 ('restaurant','Lobo Espetaria'),('whatsapp',''),('delivery_fee','0');
`);

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

function setting(k){ const r=db.prepare("SELECT value FROM settings WHERE key=?").get(k); return r?.value ?? ""; }
function setSetting(k,v){ db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k,String(v)); }
function auth(req,res,next){
 const token=req.headers.authorization?.replace("Bearer ","");
 if(token !== process.env.ADMIN_TOKEN) return res.status(401).json({error:"Não autorizado."});
 next();
}
function rowToOrder(r){ return {...r, items:JSON.parse(r.items)}; }

app.get("/api/config",(req,res)=>res.json({
 restaurant:setting("restaurant"), whatsapp:setting("whatsapp"), deliveryFee:Number(setting("delivery_fee")||0)
}));

app.post("/api/orders",(req,res)=>{
 const b=req.body||{};
 if(!b.customer || !b.address || !Array.isArray(b.items) || !b.items.length)
   return res.status(400).json({error:"Nome, endereço e itens são obrigatórios."});
 const subtotal=Number(b.subtotal||0), fee=Number(b.deliveryFee ?? setting("delivery_fee") ?? 0);
 const total=Number(b.total ?? subtotal+fee);
 const id=crypto.randomUUID(), number=String(Date.now()).slice(-6);
 db.prepare(`INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
   id,number,Date.now(),"Novo",String(b.customer),String(b.address),
   String(b.payment||"Pix"),JSON.stringify(b.items),subtotal,fee,total,String(b.notes||"")
 );
 res.status(201).json({id,number,createdAt:Date.now(),status:"Novo",customer:b.customer,address:b.address,
 payment:b.payment||"Pix",items:b.items,subtotal,deliveryFee:fee,total,notes:b.notes||""});
});

app.get("/api/orders/:number",(req,res)=>{
 const r=db.prepare("SELECT * FROM orders WHERE number=?").get(req.params.number);
 if(!r) return res.status(404).json({error:"Pedido não encontrado."});
 res.json(rowToOrder(r));
});

app.post("/api/admin/login",(req,res)=>{
 if(String(req.body.password||"")!==ADMIN_PASSWORD) return res.status(401).json({error:"Senha inválida."});
 const token=crypto.randomBytes(32).toString("hex");
 process.env.ADMIN_TOKEN=token;
 res.json({token});
});

app.get("/api/admin/orders",auth,(req,res)=>{
 const rows=db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
 res.json(rows.map(rowToOrder));
});

app.patch("/api/admin/orders/:id",auth,(req,res)=>{
 const allowed=["Novo","Preparando","Saiu para entrega","Entregue","Cancelado"];
 if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Status inválido."});
 const info=db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
 if(!info.changes) return res.status(404).json({error:"Pedido não encontrado."});
 res.json({ok:true});
});

app.get("/api/admin/settings",auth,(req,res)=>res.json({
 restaurant:setting("restaurant"),whatsapp:setting("whatsapp"),deliveryFee:Number(setting("delivery_fee")||0)
}));

app.patch("/api/admin/settings",auth,(req,res)=>{
 if(req.body.restaurant!==undefined)setSetting("restaurant",req.body.restaurant);
 if(req.body.whatsapp!==undefined)setSetting("whatsapp",req.body.whatsapp);
 if(req.body.deliveryFee!==undefined)setSetting("delivery_fee",Number(req.body.deliveryFee)||0);
 res.json({ok:true});
});
// WEBHOOK WHATSAPP
app.get("/webhook/whatsapp",(req,res)=>{
  const mode=req.query["hub.mode"];
  const token=req.query["hub.verify_token"];
  const challenge=req.query["hub.challenge"];

  if(mode==="subscribe" && token===process.env.WHATSAPP_VERIFY_TOKEN){
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post("/webhook/whatsapp",async(req,res)=>{
  res.sendStatus(200);

  try{
    const message=req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if(!message || message.type!=="text") return;

    const from=message.from;

    const accessToken=process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId=process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion=process.env.WHATSAPP_API_VERSION;

    if(!accessToken || !phoneNumberId || !apiVersion){
      console.error("Variáveis do WhatsApp não configuradas.");
      return;
    }

    await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${accessToken}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          messaging_product:"whatsapp",
          to:from,
          type:"text",
          text:{
            body:"Olá! 🐺 Recebemos sua mensagem. O Lobo Espetaria agradece o contato!"
          }
        })
      }
    );

  }catch(error){
    console.error("Erro no webhook WhatsApp:",error);
  }
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`🐺 Lobo Espetaria rodando em http://localhost:${PORT}`));
