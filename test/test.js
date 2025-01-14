import { report } from '../client/reduce.js'
import expect from 'expect.js'

describe('reduce plugin', () => {
  describe('parsing', () => {
    it('recognizes FOLD', () => {
      expect(report.parse('FOLD use these pages')).to.eql({ find: 'use these pages' })
    })
    it('recognizes WATCH', () => {
      expect(report.parse('WATCH Bottles of Beer')).to.eql({ watch: 'Bottles of Beer' })
    })
    it('recognizes SLIDE', () => {
      expect(report.parse('SLIDE Take Some Down')).to.eql({ slide: 'Take Some Down' })
    })
    it('reports errors', () => {
      expect(report.parse('watch the olympics')).to.eql({
        error: { line: 'watch the olympics', message: "can't make sense of line" },
      })
    })
  })
})
