import { applyOptions_wonde_ANZ } from './applyOptions_wonde_ANZ'
import { applyOptions_Christ_Church_Grammer } from './applyOptions_Christ_Church_Grammer'
import { applyOptions_Claires_Court_Schools } from './applyOptions_Claires_Court_Schools'
/**
 * Schools use the classroom names and subject fields in different ways
 * Therefore it requires school-specific processing to identify
 * what classrooms to include and filter out.
 *
 * Clumsy but unavoidable until schools adopt a consistent naming convention
 */
export function applyOptionsSchoolSpecific(
  wondeStudents, // the raw wonde data to be filtered
  yearOptions, // the list of years to include
  kinterDayClasses,
  kinterDayClassName,
  coreSubjectOption,
  selectedSchool, // the school being processed
) {
  // apply school-Specific filters
  switch (selectedSchool.wondeID) {
    case 'A5960542': // Wonde ANZ Testing School (AU)
      return applyOptions_wonde_ANZ(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
      )
    case 'A605175766': //Christ Church Grammar School (AU)
      return applyOptions_Christ_Church_Grammer(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
      )
    case 'A809309573': //Claires Court Schools (UK)
      return applyOptions_Claires_Court_Schools(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
      )
    default:
      return []
  }
}
