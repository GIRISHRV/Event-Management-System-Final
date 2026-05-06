const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

walk('src', function(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Patch adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    content = content.replace(/createClient\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL\s*!,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*!\s*\)/g, 
        'createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { global: { headers: { "ngrok-skip-browser-warning": "true" } } })');
    
    // Patch createClient(url, key) with no options
    content = content.replace(/createClient\(url,\s*key\)/g, 'createClient(url, key, { global: { headers: { "ngrok-skip-browser-warning": "true" } } })');
    
    // Patch createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
    content = content.replace(/createClient\(url,\s*key,\s*\{\s*global:\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`\s*\}\s*\}\s*\}\)/g, 
        'createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } } })');

    if (original !== content) {
        fs.writeFileSync(filePath, content);
        console.log('Patched ' + filePath);
    }
});
