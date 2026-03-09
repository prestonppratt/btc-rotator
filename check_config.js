import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    const configPath = join(__dirname, 'amplify_outputs.json');
    const fileContent = await readFile(configPath, 'utf8');
    const config = JSON.parse(fileContent);

    console.log('Full Config:', JSON.stringify(config, null, 2));

    if (config.data && config.data.api_key) {
        console.log('API Key IS present.');
    } else {
        console.log('API Key is MISSING.');
    }
} catch (error) {
    console.error('Error reading config:', error);
}
