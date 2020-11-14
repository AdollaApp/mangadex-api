const getTestClient = require('../jest/get-test-client')

describe('chapter api', () => {
  it('should get chapter from api', async () => {
    const client = await getTestClient()
    const expected = [
      'id',
      'hash',
      'mangaId',
      'mangaTitle',
      'volume',
      'chapter',
      'title',
      'language',
      'groups',
      'uploader',
      'timestamp',
      'comments',
      'views',
      'status',
      'pages',
      'server',
      'serverFallback',
      'fallbackPages',
      'languageName'
    ]
    const result = await client.chapter.getChapter(300859)

    expect(Object.keys(result)).toEqual(expect.arrayContaining(expected))
  })
})
