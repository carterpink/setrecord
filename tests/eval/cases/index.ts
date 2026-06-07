/** Aggregated eval cases — all 15 matrix categories (210 prompts). */
import type { EvalCase } from '../types'
import { cat01 } from './cat01_search'
import { cat02 } from './cat02_bpmkey'
import { cat03 } from './cat03_transitions'
import { cat04 } from './cat04_setbuilding'
import { cat05 } from './cat05_gighistory'
import { cat06 } from './cat06_energymood'
import { cat07 } from './cat07_similarity'
import { cat08 } from './cat08_genre'
import { cat09 } from './cat09_librarymgmt'
import { cat10 } from './cat10_importexport'
import { cat11 } from './cat11_stats'
import { cat12 } from './cat12_cratedigging'
import { cat13 } from './cat13_venuecrowd'
import { cat14 } from './cat14_djknowledge'
import { cat15 } from './cat15_edgecases'

export const ALL_CASES: EvalCase[] = [
  ...cat01,
  ...cat02,
  ...cat03,
  ...cat04,
  ...cat05,
  ...cat06,
  ...cat07,
  ...cat08,
  ...cat09,
  ...cat10,
  ...cat11,
  ...cat12,
  ...cat13,
  ...cat14,
  ...cat15
]
