import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        exclude: ['node_modules/**/*', 'dist/**/*'],
        setupFiles: ['dotenv/config'],
        testTimeout: 20000,
    },
})
