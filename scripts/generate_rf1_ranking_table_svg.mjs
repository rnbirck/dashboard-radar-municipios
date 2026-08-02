import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const outputPath = resolve(projectRoot, 'docs/exports/ranking-rf1-2025-vs-2024-somente-tabela.svg')

const ranking2025 = JSON.parse(
  await readFile(resolve(projectRoot, 'public/data/v2025/rankings/2025/rf1.json'), 'utf8'),
).data
const ranking2024 = JSON.parse(
  await readFile(resolve(projectRoot, 'public/data/v2025/rankings/2024/rf1.json'), 'utf8'),
).data

const previousByMunicipality = new Map(
  ranking2024.municipalities.map((municipality) => [municipality.municipalityId, municipality]),
)

const dimensions = [
  { label: 'Geral', key: 'overallRank' },
  { label: 'Educação', key: 'educacao' },
  { label: 'Finanças', key: 'financas' },
  { label: 'Meio Ambiente', key: 'meioAmbiente' },
  { label: 'Saúde', key: 'saude' },
  { label: 'Segurança', key: 'seguranca' },
  { label: 'Socioeconômico', key: 'socioeconomico' },
]

const rows = ranking2025.municipalities.slice(0, 15).map((municipality) => {
  const previous = previousByMunicipality.get(municipality.municipalityId)
  const values = dimensions.map(({ key }) => {
    const rank = key === 'overallRank' ? municipality.overallRank : municipality.dimensionRanks[key]
    const previousRank = key === 'overallRank' ? previous.overallRank : previous.dimensionRanks[key]
    return { rank, variation: previousRank - rank }
  })
  return {
    municipality: municipality.municipalityName,
    corede: municipality.coredeName,
    values,
  }
})

const width = 2600
const municipalityWidth = 340
const coredeWidth = 380
const identityWidth = municipalityWidth + coredeWidth
const groupWidth = (width - identityWidth) / dimensions.length
const rankWidth = 100
const variationWidth = groupWidth - rankWidth
const groupHeaderHeight = 60
const subHeaderHeight = 52
const headerHeight = groupHeaderHeight + subHeaderHeight
const rowHeight = 108
const height = headerHeight + rows.length * rowHeight
const wordWidthCm = 18
const wordHeightCm = wordWidthCm * height / width

const colors = {
  ink: '#142a41',
  muted: '#52657a',
  border: '#d8e2e9',
  borderStrong: '#bdccd8',
  header: '#e9f2f6',
  rowAlt: '#fbfcfd',
  white: '#ffffff',
  good: '#087654',
  goodBg: '#dff3ea',
  goodBorder: '#b7dfcf',
  middle: '#8a5a12',
  middleBg: '#fff1cf',
  middleBorder: '#ecd196',
  low: '#b4232d',
  lowBg: '#fde8e8',
  lowBorder: '#efc1c4',
  neutral: '#526277',
  neutralBg: '#eef2f6',
  neutralBorder: '#d7e0e7',
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function number(value) {
  return Number(value.toFixed(3))
}

function rect(x, y, rectWidth, rectHeight, options = {}) {
  const {
    fill = 'none',
    stroke = 'none',
    strokeWidth = 0,
    radius = 0,
  } = options
  return `<rect x="${number(x)}" y="${number(y)}" width="${number(rectWidth)}" height="${number(rectHeight)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
}

function text(x, y, value, options = {}) {
  const {
    anchor = 'middle',
    fill = colors.ink,
    size = 18,
    weight = 700,
    letterSpacing = 0,
  } = options
  return `<text x="${number(x)}" y="${number(y)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}">${escapeXml(value)}</text>`
}

function splitText(value, maximumCharacters) {
  if (value.length <= maximumCharacters) return [value]
  const words = value.split(' ')
  const lines = []
  let currentLine = ''
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maximumCharacters || currentLine === '') {
      currentLine = candidate
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  if (lines.length <= 2) return lines
  return [lines[0], lines.slice(1).join(' ')]
}

function wrappedText(x, y, value, maximumCharacters, options = {}) {
  const lines = splitText(value, maximumCharacters)
  if (lines.length === 1) return text(x, y, lines[0], options)
  const size = options.size ?? 18
  const lineHeight = size * 1.12
  return lines
    .map((line, index) => text(x, y + (index - (lines.length - 1) / 2) * lineHeight, line, options))
    .join('')
}

function line(x1, y1, x2, y2, options = {}) {
  const { stroke = colors.border, strokeWidth = 1 } = options
  return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
}

function rankTone(rank) {
  const percentile = rank / ranking2025.municipalityCount
  if (percentile <= 0.5) {
    return { fill: colors.goodBg, stroke: colors.goodBorder, text: colors.good }
  }
  if (percentile <= 0.75) {
    return { fill: colors.middleBg, stroke: colors.middleBorder, text: colors.middle }
  }
  return { fill: colors.lowBg, stroke: colors.lowBorder, text: colors.low }
}

function variationTone(variation) {
  if (variation > 0) {
    return { fill: colors.goodBg, stroke: colors.goodBorder, text: colors.good, arrow: '↑', label: `+${variation}` }
  }
  if (variation < 0) {
    return { fill: colors.lowBg, stroke: colors.lowBorder, text: colors.low, arrow: '↓', label: `−${Math.abs(variation)}` }
  }
  return { fill: colors.neutralBg, stroke: colors.neutralBorder, text: colors.neutral, arrow: '—', label: '0' }
}

const svg = []
svg.push(`<?xml version="1.0" encoding="UTF-8"?>`)
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${number(wordWidthCm)}cm" height="${number(wordHeightCm)}cm" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" shape-rendering="geometricPrecision">`)
svg.push(`<title id="title">Ranking municipal da Região Funcional 1</title>`)
svg.push(`<desc id="description">Tabela com os 15 primeiros municípios no ranking de 2025 e a variação frente a 2024, no geral e em seis dimensões.</desc>`)
svg.push(`<style>text { font-family: "Source Sans 3", "Segoe UI", Arial, sans-serif; font-variant-numeric: tabular-nums; }</style>`)
svg.push(rect(0, 0, width, height, { fill: colors.white }))

// Cabeçalho das colunas de identidade.
svg.push(rect(0, 0, municipalityWidth, headerHeight, { fill: colors.header }))
svg.push(rect(municipalityWidth, 0, coredeWidth, headerHeight, { fill: colors.header }))
svg.push(text(18, headerHeight / 2, 'MUNICÍPIO', { anchor: 'start', fill: colors.ink, size: 24, weight: 900, letterSpacing: 0.6 }))
svg.push(text(municipalityWidth + 18, headerHeight / 2, 'COREDE', { anchor: 'start', fill: colors.ink, size: 24, weight: 900, letterSpacing: 0.6 }))

// Cabeçalhos agrupados.
dimensions.forEach((dimension, index) => {
  const groupX = identityWidth + index * groupWidth
  svg.push(rect(groupX, 0, groupWidth, groupHeaderHeight, { fill: colors.header }))
  svg.push(rect(groupX, groupHeaderHeight, rankWidth, subHeaderHeight, { fill: colors.header }))
  svg.push(rect(groupX + rankWidth, groupHeaderHeight, variationWidth, subHeaderHeight, { fill: colors.header }))
  svg.push(text(groupX + groupWidth / 2, groupHeaderHeight / 2, dimension.label.toUpperCase(), {
    fill: colors.ink,
    size: 21,
    weight: 900,
    letterSpacing: 0.5,
  }))
  svg.push(text(groupX + rankWidth / 2, groupHeaderHeight + subHeaderHeight / 2, 'POS. 2025', {
    fill: colors.muted,
    size: 17,
    weight: 850,
    letterSpacing: 0.7,
  }))
  svg.push(text(groupX + rankWidth + variationWidth / 2, groupHeaderHeight + subHeaderHeight / 2, 'VAR.', {
    fill: colors.muted,
    size: 17,
    weight: 850,
    letterSpacing: 0.7,
  }))
})

// Linhas de dados.
rows.forEach((row, rowIndex) => {
  const y = headerHeight + rowIndex * rowHeight
  const fill = rowIndex % 2 === 0 ? colors.white : colors.rowAlt
  svg.push(rect(0, y, width, rowHeight, { fill }))
  svg.push(wrappedText(18, y + rowHeight / 2, row.municipality, 18, {
    anchor: 'start',
    fill: '#0f3652',
    size: 30,
    weight: 900,
  }))
  svg.push(wrappedText(municipalityWidth + 18, y + rowHeight / 2, row.corede, 18, {
    anchor: 'start',
    fill: '#344a63',
    size: 25,
    weight: 750,
  }))

  row.values.forEach(({ rank, variation }, dimensionIndex) => {
    const groupX = identityWidth + dimensionIndex * groupWidth
    const rankStyle = rankTone(rank)
    const rankBadgeWidth = dimensionIndex === 0 ? 80 : 72
    const rankBadgeHeight = dimensionIndex === 0 ? 52 : 48
    const rankX = groupX + rankWidth / 2 - rankBadgeWidth / 2
    const rankY = y + rowHeight / 2 - rankBadgeHeight / 2
    svg.push(rect(rankX, rankY, rankBadgeWidth, rankBadgeHeight, {
      fill: rankStyle.fill,
      stroke: rankStyle.stroke,
      strokeWidth: 1.3,
      radius: 9,
    }))
    svg.push(text(groupX + rankWidth / 2, y + rowHeight / 2 + 1, `${rank}º`, {
      fill: rankStyle.text,
      size: dimensionIndex === 0 ? 29 : 28,
      weight: 900,
    }))

    const variationStyle = variationTone(variation)
    const pillWidth = 124
    const pillHeight = 48
    const pillCenterX = groupX + rankWidth + variationWidth / 2
    svg.push(rect(pillCenterX - pillWidth / 2, y + rowHeight / 2 - pillHeight / 2, pillWidth, pillHeight, {
      fill: variationStyle.fill,
      stroke: variationStyle.stroke,
      strokeWidth: 1.3,
      radius: 18,
    }))
    svg.push(text(pillCenterX, y + rowHeight / 2 + 1, `${variationStyle.arrow} ${variationStyle.label}`, {
      fill: variationStyle.text,
      size: 24,
      weight: 900,
    }))
  })
})

// Grade e separadores.
svg.push(line(0, headerHeight, width, headerHeight, { stroke: colors.borderStrong, strokeWidth: 1.5 }))
svg.push(line(0, 0, width, 0, { stroke: colors.borderStrong, strokeWidth: 1.5 }))
svg.push(line(0, height, width, height, { stroke: colors.borderStrong, strokeWidth: 1.5 }))
svg.push(line(0, 0, 0, height, { stroke: colors.borderStrong, strokeWidth: 1.5 }))
svg.push(line(width, 0, width, height, { stroke: colors.borderStrong, strokeWidth: 1.5 }))
svg.push(line(municipalityWidth, 0, municipalityWidth, height))
svg.push(line(identityWidth, 0, identityWidth, height, { stroke: colors.borderStrong, strokeWidth: 2 }))

dimensions.forEach((_, index) => {
  const groupX = identityWidth + index * groupWidth
  if (index > 0) svg.push(line(groupX, 0, groupX, height, { stroke: colors.borderStrong, strokeWidth: 2 }))
  svg.push(line(groupX + rankWidth, groupHeaderHeight, groupX + rankWidth, height))
  svg.push(line(groupX, groupHeaderHeight, groupX + groupWidth, groupHeaderHeight, { stroke: colors.borderStrong, strokeWidth: 1.2 }))
})

for (let index = 1; index <= rows.length; index += 1) {
  const y = headerHeight + index * rowHeight
  svg.push(line(0, y, width, y))
}

svg.push(`</svg>`)

await writeFile(outputPath, svg.join('\n'), 'utf8')
console.log(`SVG gerado: ${outputPath}`)
