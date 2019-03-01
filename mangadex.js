const axios = require('axios').default
const merge = require('deepmerge')
const LRU = require('lru-cache')
const { parseSearch } = require('./scraper')
const api = axios.create({
  baseURL: 'https://mangadex.org/api/',
  validateStatus: () => true
})
const MangadexError = require('./lib/error')
// const validate = require('./lib/validate')
const Composer = require('./lib')

const sharedMangaCache = new LRU({ maxAge: 600000 })

const sharedChapterCache = new LRU({ maxAge: 600000 })

const DefaultOptions = {
  cacheTimeout: 600000,
  mangaCacheTimeout: 0,
  chapterCachetimeout: 0,
  cacheMangaResult: false,
  cacheChapterResult: false,
  shareMangaCache: false,
  shareChapterCache: false
}

class Mangadex extends Composer {
  constructor (options) {
    super()
    this.options = Object.assign({}, DefaultOptions, options)

    if (!this.options.shareMangaCache) {
      this.mangaCache = new LRU({
        maxAge: this.options.mangaCacheTimeout ? this.options.mangaCacheTimeout : this.options.cacheTimeout
      })
    }
    if (!this.options.shareChapterCache) {
      this.chapterCache = new LRU({
        maxAge: this.options.chapterCachetimeout ? this.options.chapterCachetimeout : this.options.cacheTimeout
      })
    }
    this.getChapter = this.getChapter.bind(this)
    this.getManga = this.getManga.bind(this)
  }

  getManga (mangaId, normalize = true, params = {}) {
    if (this.options.cacheMangaResult) {
      const cachedResult = this.options.shareMangaCache
        ? sharedMangaCache.get(`${mangaId}:${normalize === true ? '1' : '0'}`)
        : this.mangaCache.get(`${mangaId}:${normalize === true ? '1' : '0'}`)
      if (cachedResult) {
        return cachedResult
      } else {
        return Mangadex.getManga(mangaId, normalize, params)
          .then(result => {
            if (this.options.shareMangaCache) {
              sharedMangaCache.set(
                `${mangaId}:${normalize === true ? '1' : '0'}`,
                result,
                this.options.mangaCacheTimeout
                  ? this.options.mangaCacheTimeout
                  : this.options.cacheTimeout
              )
            } else {
              this.mangaCache.set(`${mangaId}:${normalize === true ? '1' : '0'}`, result)
            }
            return result
          })
      }
    }
    return Mangadex.getManga(mangaId, normalize, params)
  }

  getChapter (chapterId, normalize = true, params = {}) {
    if (this.options.cacheChapterResult) {
      const cachedResult = this.options.sharedChapteCache
        ? sharedChapterCache.get(`${chapterId}:${normalize === true ? '1' : '0'}`)
        : this.chapterCache.get(`${chapterId}:${normalize === true ? '1' : '0'}`)
      if (cachedResult) {
        return cachedResult
      } else {
        return Mangadex.getChapter(chapterId, normalize, params)
          .then(result => {
            if (this.options.sharedChapteCache) {
              sharedChapterCache.set(
                `${chapterId}:${normalize === true ? '1' : '0'}`,
                result,
                this.options.chapterCachetimeout
                  ? this.options.chapterCachetimeout
                  : this.options.cacheTimeout
              )
            } else {
              this.chapterCache.set(`${chapterId}:${normalize === true ? '1' : '0'}`, result)
            }
            return result
          })
      }
    }
    return Mangadex.getChapter(chapterId, normalize, params)
  }

  search (query, searchSegment = 'title', params = {}) {
    return Mangadex.search(query, searchSegment, params)
  }

  static getManga (mangaId, normalize = true, params = {}) {
    return api
      .get(`manga/${mangaId}`, params)
      .then(response => normalize ? normalizeManga(response) : response.data)
  }

  static getChapter (chapterId, normalize = true, params = {}) {
    return api
      .get(`chapter/${chapterId}`, params)
      .then(response => normalize ? normalizeChapter(response) : response.data)
  }

  static search (query, searchSegment = 'title', params = {}) {
    return axios
      .get(
        'https://mangadex.org/search',
        merge.all([
          {
            params: {
              [searchSegment]: query
            }
          },
          params
        ])
      )
      .then(response => parseSearch(response.data))
  }
}

module.exports = Object.assign(Mangadex, {
  Composer
})

module.exports.default = Object.assign(Mangadex, {
  Composer
})

const normalizeManga = response => {
  if (response.status !== 200) throw new MangadexError(response.data, response)
  const mangaData = response.data
  // const validManga = validate.manga(mangaData)
  // if (!validManga.ok) {
  //   mangaData.missedKeys = validManga.missed
  // }
  const { chapter } = mangaData
  if (typeof chapter === 'object') {
    const fixedChapters = Object.keys(chapter).map(id => ({ id: Number.parseInt(id), lang_name: Composer.getLangName(chapter[id].lang_code), ...chapter[id] }))
    fixedChapters.sort((a, b) => Number(a.chapter) - Number(b.chapter))
    mangaData.chapter = fixedChapters
  }
  mangaData.manga.cover_url = `https://cdndex.com${mangaData.manga.cover_url}`
  if (typeof mangaData.manga.genres === 'object' && mangaData.manga.genres !== null) {
    mangaData.manga.genres = Composer.getGenres(mangaData.manga.genres)
  }
  if (typeof mangaData.manga.status === 'number') {
    mangaData.manga.status_text = Composer.getStatus(mangaData.manga.status)
  }
  if (typeof mangaData.manga.links === 'object' && mangaData.manga.links !== null) {
    mangaData.manga.links = Composer.getMangaLinks(mangaData.manga.links)
  }
  if (typeof mangaData.manga.description === 'string') {
    mangaData.manga.description = Composer.parseToHTML(mangaData.manga.description)
  }
  return mangaData
}

const normalizeChapter = response => {
  if (response.status !== 200) throw new MangadexError(response.data, response)
  const chapter = response.data
  // const validChapter = validate.chapter(chapter)
  // if (!validChapter.ok) {
  //   chapter.missedKeys = validChapter.missed
  // }
  if (chapter.server === '/data/') {
    chapter.server = 'https://mangadex.org/data/'
  }
  if (typeof chapter.page_array === 'object') {
    chapter.page_array = chapter.page_array.map(page => `${chapter.server}${chapter.hash}/${page}`)
  }
  return chapter
}
