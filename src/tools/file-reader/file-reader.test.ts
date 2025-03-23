import { describe, expect, test } from 'vitest'
import { FileReader } from './file-reader.ts'

describe('File reader', () => {
    test('should read file', async () => {
        const fileReader = new FileReader()
        const filePath = 'test.txt'
        const fileContent = await fileReader.execute({ path: filePath })

        expect(fileContent).toEqual({
            content: `Content of ${filePath}\n`.repeat(10),
            name: filePath,
        })

        expect(fileReader.toString()).toEqual(
            '{"name":"File Reader","description":"Reads the content of a file","inputSchema":{"_def":{"unknownKeys":"strip","catchall":{"_def":{"typeName":"ZodNever"},"~standard":{"version":1,"vendor":"zod"}},"typeName":"ZodObject"},"~standard":{"version":1,"vendor":"zod"},"_cached":null},"outputSchema":{"_def":{"unknownKeys":"strip","catchall":{"_def":{"typeName":"ZodNever"},"~standard":{"version":1,"vendor":"zod"}},"typeName":"ZodObject"},"~standard":{"version":1,"vendor":"zod"},"_cached":null}}'
        )
    })
})
