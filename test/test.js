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
})
