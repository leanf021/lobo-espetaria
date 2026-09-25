# 🐺 Lobo Espetaria V6 — sistema real

Esta versão acrescenta uma base real de produção:
- banco SQLite no servidor;
- pedidos persistentes;
- número de pedido e consulta pública;
- painel administrativo protegido por senha;
- mudança de status salva no banco;
- configurações do restaurante e taxa de entrega;
- atualização automática do painel;
- WhatsApp por link com mensagem pronta.

## Rodar
Requer Node.js 18+.

```bash
npm install
ADMIN_PASSWORD="uma-senha-forte" npm start
```
Abra `http://localhost:3000`.

No Windows PowerShell:
```powershell
$env:ADMIN_PASSWORD="uma-senha-forte"
npm start
```

Senha padrão se a variável não for configurada: `lobo123`. **Troque antes de publicar.**

## O que ainda depende de contas externas
1. **Domínio/hospedagem:** precisa publicar este projeto em um servidor Node.
2. **WhatsApp automatizado:** o botão abre o WhatsApp com o pedido pronto. Para mensagens automáticas recebidas/enviadas pelo sistema, é necessário configurar a WhatsApp Business Platform ou um provedor oficial e credenciais.
3. **Pagamento online/Pix automático:** requer um provedor de pagamento e credenciais. O sistema atual registra a forma de pagamento escolhida, mas não cobra sozinho.

## Próxima infraestrutura recomendada
Para produção com volume maior, migrar SQLite para PostgreSQL/Supabase e adicionar backup, HTTPS, login com sessão segura e integração oficial do WhatsApp.
