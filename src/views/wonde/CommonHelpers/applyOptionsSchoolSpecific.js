// AU Schpools
import { applyOptions_wonde_ANZ } from './applyOptions_wonde_ANZ'
import { applyOptions_wondeTestingSchoolUK } from './applyOptions_wondeTestingSchoolUK.js'
import { applyOptions_Christ_Church_Grammer } from './applyOptions_Christ_Church_Grammer'
import { applyOptions_StAndrewAndStFrancisCofEPrimarySchool } from './applyOptions_StAndrewAndStFrancisCofEPrimarySchool'
import { applyOptions_StMonicaCatholicPrimarySchool } from './applyOptions_StMonicaCatholicPrimarySchool'
import { applyOptions_Claires_Court_School } from './applyOptions_Claires_Court_Schools'
import { applyOptions_StMarkPrimarySchool } from './applyOptions_StMarkPrimarySchool'
import { applyOptions_ParksideCommunityPrimarySchool } from './applyOptions_ParksideCommunityPrimarySchool'
import { applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool } from './applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool'
import { applyOptions_EnglishMartyrsCatholicPrimarySchool } from './applyOptions_EnglishMartyrsCatholicPrimarySchool'
import { applyOptions_StPeterChurchOfEnglandPrimarySchool } from './applyOptions_StPeterChurchOfEnglandPrimarySchool'
import { applyOptions_MayvillePrimarySchool } from './applyOptions_MayvillePrimarySchool'
import { applyOptions_TheKingsSchoolEly } from './applyOptions_TheKingsSchoolEly'
import { applyOptions_DefaultSchool } from './applyOptions_DefaultSchool'
/**
 * Schools use the classroom names and subject fields in different ways
 * Therefore it requires school-specific processing to identify
 * what classrooms to include and filter out.
 *
 * Note these filters are used for new scholl uptakes, where the options are provided as parameters
 * and for later updates where the options should be blank, but the school specific routine
 * should "remember" the options applied during the uptake.
 */
export function applyOptionsSchoolSpecific(
  wondeStudents, // the raw wonde data to be filtered
  yearOptions, // the list of years to include
  kinterDayClasses,
  kinterDayClassName,
  coreSubjectOption,
  mergePrimaryClassesOption,
  selectedSchool, // the school being processed
) {
  console.log(selectedSchool)
  // apply school-Specific filters
  switch (selectedSchool.wondeID) {
    case 'A5960542': // Wonde ANZ Testing School (AU)
      return applyOptions_wonde_ANZ(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A605175766': //Christ Church Grammar School (AU)
      return applyOptions_Christ_Church_Grammer(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1930499544': // Wonde Testing School (UK)
      return applyOptions_wondeTestingSchoolUK(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1895992081': //	St Andrew and St Francis CofE Primary School (UK)
      return applyOptions_StAndrewAndStFrancisCofEPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1802201454': //	St Monica's Catholic Primary School (UK)
      return applyOptions_StMonicaCatholicPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A809309573': //Claires Court Schools (UK)
      return applyOptions_Claires_Court_School(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1732060724': //	St Mark's Primary School (UK)
      return applyOptions_StMarkPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A23570669': // Parkside Community Primary School (UK)
      return applyOptions_ParksideCommunityPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A901324615': //Our Lady Star of the Sea Catholic Primary School (UK)
      return applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1102074985': //English Martyrs' Catholic Primary School (UK)
      return applyOptions_EnglishMartyrsCatholicPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A1084772819': //	St Peter's Church of England Primary School (UK)
      return applyOptions_StPeterChurchOfEnglandPrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A509965888': //	Mayville Primary School (UK)
      return applyOptions_MayvillePrimarySchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    case 'A111084749': //	The King's School Ely (UK)
      return applyOptions_TheKingsSchoolEly(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
    default:
      return applyOptions_DefaultSchool(
        wondeStudents,
        yearOptions,
        kinterDayClasses,
        kinterDayClassName,
        coreSubjectOption,
        mergePrimaryClassesOption,
      )
  }
}
