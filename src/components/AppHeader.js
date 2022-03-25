import React, { useContext } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import loggedInContext from 'src/loggedInContext'
import {
  CContainer,
  CHeader,
  CHeaderBrand,
  CHeaderDivider,
  CHeaderToggler,
  CCol,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu } from '@coreui/icons'

import { logoNegative } from 'src/assets/brand/logo-negative'

import { getRegionName } from 'src/views/wonde/CommonHelpers/featureToggles'

function AppHeader() {
  const { loggedIn } = useContext(loggedInContext)
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  function getLoggedInUser() {
    return loggedIn.username
  }

  return (
    <CHeader position="sticky" className="mb-4">
      <CContainer fluid>
        <CHeaderToggler
          className="ps-1"
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderBrand className="mx-auto d-md-none" to="/">
          <CIcon icon={logoNegative} height={48} alt="Logo" />
        </CHeaderBrand>
      </CContainer>
      <CHeaderDivider />
      <CContainer>
        <CRow>
          <CCol sm="auto">
            <span style={{ fontWeight: 'bold' }}>Region:</span>
          </CCol>
          <CCol sm="auto">{getRegionName()}</CCol>
          <CCol sm="auto">
            <span style={{ fontWeight: 'bold' }}>Logged In User:</span>
          </CCol>
          <CCol sm="auto">{getLoggedInUser()}</CCol>
        </CRow>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
