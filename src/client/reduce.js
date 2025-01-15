/*
 * Federated Wiki : Reduce Plugin
 *
 * Licensed under the MIT license.
 * https://github.com/fedwiki/wiki-plugin-reduce/blob/master/LICENSE.txt
 */

// interpret item's markup

const parse = text => {
  const program = {}
  for (const line of text.split(/\n/)) {
    const words = line.match(/\S+/g)
    if (words == null || words.length < 1) {
      // ignore it
    } else if (words[0] === 'FOLD') {
      program.find = words.slice(1).join(' ')
    } else if (words[0] === 'WATCH') {
      program.watch = words.slice(1).join(' ')
    } else if (words[0] === 'SLIDE') {
      program.slide = words.slice(1).join(' ')
    } else program.error = { line, message: "can't make sense of line" }
  }
  return program
}

const find = (program, page) => {
  const titles = []
  let parsing = false

  if (program.find) {
    for (const item of page.story) {
      if (item.type === 'pagefold') {
        parsing = item.text === program.find
      } else if (parsing && item.type === 'paragraph') {
        const links = item.text.match(/\[\[.*?\]\]/g)
        if (links) {
          for (const link of links) {
            titles.push({ title: link.substring(2, link.length - 4) })
          }
        }
      }
    }
  }
  return titles
}

const format = (program, titles) => {
  const rows = []
  if (program.error) {
    rows.push(`<tr><td><p class="error">${program.error.line} <span title="${program.error.message}">*`)
  }
  for (const title of titles) {
    rows.push(`<tr><td>${title.title}<td style="text-align:right;">50`)
  }
  rows.join('\n')
}

// translate to functional form (excel)

const emitrow = (context, label, funct) => {
  if (label) context.vars[label] = context.ops.length
  context.ops.push(`${label || ''}\t${funct || ''}`)
}

const generate = (context, text) => {
  let loc = context.ops.length + 1
  let args
  for (const line of text.split(/\n/)) {
    console.log(line, context)
    if ((args = line.match(/^([0-9.eE-]+) +([\w /%(){},&-]+)$/))) emitrow(context, args[2], args[1])
    else if ((args = line.match(/^([A-Z]+) +([\w /%(){},&-]+)$/))) {
      emitrow(context, args[2], `=${args[1]}(B${loc}:B${context.ops.length})`)
      loc = context.ops.length
    } else if ((args = line.match(/^([A-Z]+)$/))) {
      emitrow(context, null, `=${args[1]}(B${loc}:B${context.ops.length})`)
      loc = context.ops.length
    } else if ((args = line.match(/^([0-9.eE-]+)$/))) {
      emitrow(context, null, args[1])
    } else if ((args = line.match(/^ *([\w /%(){},&-]+)$/))) {
      emitrow(context, args[1], `=B${context.vars[args[1]] + 1}`)
    } else {
      emitrow(context, "can't parse '${line}'")
    }
  }
}
const compile = async (program, titles, done) => {
  try {
    const fetches = titles.map(title => $.getJSON(`/${wiki.asSlug(title.title)}.json`))
    const results = await Promise.all(fetches)

    const context = { ops: [], vars: {} }
    if (program.slide) {
      emitrow(context, program.slide, 50)
    }

    for (const result of results) {
      emitrow(context)
      emitrow(context, result[0].title)
      for (const item of result[0].story) {
        if (item.type === 'method') {
          generate(context, item.text)
        }
      }
    }

    console.log(context)
    done(context.ops.join('\n'))
  } catch (error) {
    console.error('Compile error:', error)
  }
}

const code = ($item, item, done) => {
  const program = parse(item.text)
  const page = $item.parents('.page').data('data')
  const titles = find(program, page)
  compile(program, titles, done)
}

const prefetch = async (titles, done) => {
  try {
    const fetches = titles.map(title => $.getJSON(`/${wiki.asSlug(title.title)}.json`))
    const results = await Promise.all(fetches)

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i]
      const result = results[i]
      title.items = []

      for (const item of result[0].story) {
        if (item.type === 'method') {
          title.items.push(item)
        }
      }
    }
    done(titles)
  } catch (error) {
    console.error('Prefetch error:', error)
  }
}

const performMethod = async (state, done) => {
  if (state.methods.length > 0) {
    const method = state.methods.shift()
    try {
      await new Promise(resolve => {
        state.plugin.eval(state, method, state.input, (updatedState, output) => {
          state.output = output
          Object.assign(state.input, output)
          resolve()
        })
      })
      await performMethod(state, done)
    } catch (error) {
      console.error('Method performance error:', error)
    }
  } else {
    done(state)
  }
}

const performTitle = async (state, done) => {
  if (state.titles.length > 0) {
    state.methods = state.titles[0].items.filter(item => item)
    try {
      await performMethod(state, state => {
        const value = state.input[state.program.watch || state.program.slide]
        state.titles[0].row.find('td:last').text(value.toFixed(2))
        state.titles.shift()
        performTitle(state, done)
      })
    } catch (error) {
      console.error('Title performance error:', error)
    }
  } else {
    done(state)
  }
}

const recalculate = async (program, input, titles, done) => {
  wiki.getPlugin('method', plugin => {
    const state = {
      program,
      plugin,
      input,
      titles: [...titles],
      errors: [],
    }
    performTitle(state, done)
  })
}

const emit = ($item, item) => {
  const program = parse(item.text)
  const page = $item.parents('.page').data('data')
  const titles = find(program, page)

  const input = {}
  const output = {}
  let nominal

  const candidates = $('.item:lt(' + $('.item').index($item) + ')')
  for (const elem of candidates) {
    const $elem = $(elem)
    if ($elem.hasClass('radar-source')) {
      Object.assign(input, elem.radarData())
    } else if ($elem.hasClass('data')) {
      Object.assign(input, $elem.data('item').data[0])
    }
  }

  const slider = $('<div class="slider" />')
  $item.append(slider)

  if (program.slide) {
    nominal = output[program.slide] = +input[program.slide] || 50
    const sign = nominal < 0 ? -1 : 1

    $item.addClass('radar-source')
    $item.get(0).radarData = () => output

    slider.slider({
      animate: 'fast',
      value: Math.abs(nominal),
      max: Math.abs(nominal) * 2,
      slide: (event, ui) => {
        const value = ui.value * sign
        input[program.slide] = output[program.slide] = value
        $item.find('tr:first td:last').text(value)
        recalculate(program, input, titles, () => {
          $item.trigger('thumb', value)
        })
      },
    })
  }

  $item.append(`
      <table style="width:100%; background:#eee; padding:.8em; margin-bottom:5px;">
        <tr><td>${program.slide}<td style="text-align:right;">${nominal}
      </table>
    `)

  for (const title of titles) {
    title.row = $(`<tr><td>${title.title}<td style="text-align:right;">`)
    $item.find('table').append(title.row)
  }

  prefetch(titles, updatedTitles => {
    input[program.slide] = nominal
    recalculate(program, input, updatedTitles, () => {
      console.log('emit/prefetch/recalculate complete')
    })
  })
}

const bind = ($item, item) => {
  $item.find('table').on('dblclick', () => {
    wiki.textEditor($item, item)
  })

  $item.find('.slider').on('dblclick', () => {
    code($item, item, formula => {
      wiki.dialog('Slider Computation', `<pre>${formula}</pre>`)
    })
  })
}

if (typeof window !== 'undefined') {
  window.plugins.reduce = { emit, bind }
}

export const reduce = typeof window == 'undefined' ? { parse } : undefined
