# Checklist de testes (marque so o que voce realmente testou)
- [ ] `npm run build` sem erros
- [ ] Login com e-mail/senha; "esqueci a senha" envia e-mail e `/definir-senha` funciona
- [ ] Convite do ADM chega por e-mail, usuario define senha e entra
- [ ] Usuario da doceria NAO acessa `/m/lancamentos` (pessoal) nem dados de outros (teste via SQL/REST com a chave publishable)
- [ ] Usuario comum NAO consegue chamar `/api/admin/invite` (espera 403)
- [ ] Cadastro: ingrediente -> movimentacao de entrada -> quantidade/custo medio atualizam
- [ ] Receita com itens -> chat: "quanto preciso para 30 marmitas de X?" retorna dados reais
- [ ] Chat propoe lista de compras -> Confirmar grava; Cancelar nao grava
- [ ] Nota fiscal: enviar -> conferir -> confirmar; enviar o MESMO arquivo -> bloqueado
- [ ] PWA: instalar no Android e no iPhone; offline mostra pagina generica
- [ ] `/admin/configuracoes`: salvar chave OpenAI -> "Salvar e testar" mostra sucesso; recarregar mostra so `••••` + final; chave errada mostra erro claro
- [ ] Usuario NAO-owner (e admin adicional) recebe 403 em `GET/PUT /api/admin/settings` e nao ve o tile
- [ ] Banco: `select * from app_settings` mostra texto cifrado (nao a chave); usuario logado via REST nao le a tabela
- [ ] Remover valor da tela volta a usar a variavel de ambiente (ou avisa que IA nao esta configurada)
- [ ] Pluggy sandbox: connect token -> registrar item -> sincronizar (reimportar nao duplica)

## Pluggy (widget)
`npm i react-pluggy-connect`, crie uma tela que chame `POST /api/pluggy/connect-token`, abra o `PluggyConnect` com o `accessToken` e, no `onSuccess`, envie `{ itemId, scope: 'personal'|'business' }` para `/api/pluggy/register-item`. Depois use `POST /api/pluggy/sync { connectionId }`. Comece no sandbox da Pluggy.
