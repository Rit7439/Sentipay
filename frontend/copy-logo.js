// Copies the supplied Sentipay logo into Vite's public asset folder.
// Run: node copy-logo.js
import { copyFileSync, mkdirSync } from 'node:fs'

const src = 'C:\\Users\\WINDOWS\\Downloads\\logo.png'
const dst = './public/logo.png'

mkdirSync('./public', { recursive: true })
copyFileSync(src, dst)
console.log('Logo copied to public/logo.png')
