import { reduce } from '../src/client/reduce.js'
import { describe, it } from 'node:test'
import expect from 'expect.js'

describe('reduce plugin', () => {
  describe('parsing', () => {
    it('recognizes FOLD', () => {
      expect(reduce.parse('FOLD use these pages')).to.eql({ find: 'use these pages' })
    })
    it('recognizes WATCH', () => {
      expect(reduce.parse('WATCH Bottles of Beer')).to.eql({ watch: 'Bottles of Beer' })
    })
    it('recognizes SLIDE', () => {
      expect(reduce.parse('SLIDE Take Some Down')).to.eql({ slide: 'Take Some Down' })
    })
    it('reports errors', () => {
      expect(reduce.parse('watch the olympics')).to.eql({
        error: { line: 'watch the olympics', message: "can't make sense of line" },
      })
    })
  })

  describe('finding pages', () => {
    const page = {
      story: [
        { type: 'paragraph', text: '[[Not Yet]] before the fold' },
        { type: 'pagefold', text: 'Included Pages' },
        { type: 'paragraph', text: '[[Drink Beer Slowly]] passing one around at a time.' },
        { type: 'markdown', text: '- [[Drink Beer Similarly]]\n- [[Drink Beer in Proportion]]' },
        { type: 'pagefold', text: 'Other Section' },
        { type: 'paragraph', text: '[[Not This One]]' },
      ],
    }
    it('takes whole titles from paragraph links under the named fold', () => {
      const titles = reduce.find({ find: 'Included Pages' }, page).map(t => t.title)
      expect(titles).to.contain('Drink Beer Slowly')
    })
    it('takes links from markdown items too', () => {
      const titles = reduce.find({ find: 'Included Pages' }, page).map(t => t.title)
      expect(titles).to.eql(['Drink Beer Slowly', 'Drink Beer Similarly', 'Drink Beer in Proportion'])
    })
    it('stops at the next fold and ignores links before the fold', () => {
      const titles = reduce.find({ find: 'Included Pages' }, page).map(t => t.title)
      expect(titles).to.not.contain('Not Yet')
      expect(titles).to.not.contain('Not This One')
    })
    it('finds nothing without a FOLD', () => {
      expect(reduce.find({}, page)).to.eql([])
    })
  })
})
