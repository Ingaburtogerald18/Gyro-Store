const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'app', 'components', 'admin', 'inventory');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/~\/store\/api\/inventoryApi/g, '~/store/api/inventoryV1Api');
  fs.writeFileSync(filePath, content);
}
