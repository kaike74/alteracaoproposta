# Como Debugar - Dados Não Aparecem na Tabela

## Problema
A tabela no site não está mostrando valores de quantidade ou preço.

## Solução

### Passo 1: Descobrir o ID da Tabela Notion
1. Abra o Notion
2. Vá até a tabela com os dados das emissoras
3. Copie o ID da tabela da URL:
   - URL: `https://www.notion.so/WORKSPACE/SEU_ID_AQUI?v=...`
   - O ID é a parte após o `/` e antes de `?`

### Passo 2: Ver quais campos existem
Use este URL para listar todos os campos da sua tabela:

```
https://seu-dominio.pages.dev/notion?id=SEU_ID_AQUI&listFields=true
```

Isso vai retornar um JSON com a lista de TODOS os campos e seus tipos.

### Passo 3: Atualizar o código
Se os nomes dos seus campos forem diferentes, você precisa atualizar a função `extractValue` em `functions/notion.js`.

Procure por linhas como:
```javascript
spots30: extractValue(properties, 0, 'Spots 30"', 'Spots 30', 'spots30'),
```

E adicione os nomes corretos dos seus campos Notion.

## Exemplo
Se sua tabela tiver um campo chamado "Qtd Spots 30", você deveria adicionar:
```javascript
spots30: extractValue(properties, 0, 'Spots 30"', 'Spots 30', 'spots30', 'Qtd Spots 30'),
```

## Debug Local
Se estiver testando localmente com wrangler:
```bash
npm install -g wrangler
cd alteracaoproposta
wrangler pages dev public --port 8787
```

Depois acesse `http://localhost:8787/index.html?id=SEU_ID_AQUI`

## Checklist

- [ ] Encontrei o ID da minha tabela Notion
- [ ] Acessei `?listFields=true` e vi a lista de campos
- [ ] Comparei os nomes dos campos com o código
- [ ] Atualizei os nomes dos campos no código se necessário
- [ ] Testei a tabela novamente e os dados aparecem

## Campos Esperados (padrão)

| Campo Notion | Chave JavaScript | Exemplo |
|---|---|---|
| Emissora | emissora | "Rádio A" |
| Spots 30" | spots30 | 5 |
| Valor spot 30" (Tabela) | valorTabela30 | 100.00 |
| Valor spot 30" (Negociado) | valorNegociado30 | 85.00 |
| Impactos | impactos | 1000 |
| UF | uf | "SP" |
| Praa | praca | "São Paulo" |

Se seus campos no Notion têm nomes diferentes, eles precisam ser mapeados no código.
