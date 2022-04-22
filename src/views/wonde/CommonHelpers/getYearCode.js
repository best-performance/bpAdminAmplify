import { getYearCodeForYear0 } from './featureToggles'
import { getYearCode_KingsSchoolEly } from './getYearCode_KingsSchoolEly'
import { isAUSRegion } from './featureToggles'

const UNKNOWN = 'unknown'

export function getYearCode(student, wondeSchoolID) {
  let yearCode = UNKNOWN

  // chack if one of the schools with unusual year codes
  switch (wondeSchoolID) {
    case 'A111084749': {
      yearCode = getYearCode_KingsSchoolEly(student)
      return yearCode
    }
    default:
      // process as a "normal" case
      break
  }

  if (!(student.year && student.year.data && student.year.data.code)) {
    return yearCode
  }
  // check for known FY or K strings
  switch (student.year.data.code) {
    case 'Year R': // St Andrew and St Francis CofE Primary School, Our Lady Star of the Sea Catholic Primary School,English Martyrs' Catholic Primary School
    case 'R': // St Monica's Catholic Primary School, St Mark's Primary School
    case 'Girls Reception': // Claires Court Schools
    case 'Boys Reception': // Claires Court Schools
      yearCode = getYearCodeForYear0()
      break
    case 'N1': // St Monica's Catholic Primary School
    case 'N2': // St Mark's Primary School
    case 'Nursery': // St Andrew and St Francis CofE Primary School
    case 'Year N': // Parkside Community Primary School
    case 'Year N1': // Parkside Community Primary School,  Our Lady Star of the Sea Catholic Primary School
    case 'Year N2': // St Andrew and St Francis CofE Primary School
      yearCode = 'K'
      break
    default: {
      break
    }
  }

  // if we did not find an FY or K code then look for a numeric year level
  if (yearCode === UNKNOWN) {
    let numStr = student.year.data.code.match(/\d+/) // match returns an array
    if (numStr) {
      let upperYearLevel = isAUSRegion() ? 12 : 13
      let num = parseInt(numStr[0])
      if (num > 0 && num <= upperYearLevel) {
        //yearCode = `Y${num.toString()}`
        yearCode = num.toString() // "5" not "Y5" is expected by the csv
      } else if (num === 0) {
        // we presume year 0 is Foundation Year (AU) or Reception (UK)
        yearCode = isAUSRegion() ? 'FY' : 'R'
      } else {
        console.log(
          `Year code out of range 0-${upperYearLevel} for ${student.forename} ${student.surname} ${student.date_of_birth.date}, found ${numStr}`,
        )
      }
    }
  }
  // Just return with a prefix whatever bizarre year code the school supplied
  if (yearCode === UNKNOWN) yearCode = 'U-' + student.year.data.code
  //if (yearCode === '11') console.log('yearcode 11', student)
  return yearCode
}
