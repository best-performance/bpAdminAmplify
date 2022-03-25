import React, { useState, useContext, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CSidebar, CSidebarNav, CSidebarToggler, CContainer, CCol, CRow } from '@coreui/react'
import { AppSidebarNav } from './AppSidebarNav'
import SimpleBar from 'simplebar-react'
import 'simplebar/dist/simplebar.min.css'
// sidebar nav config
import navigation from '../_nav'
import loggedInContext from 'src/loggedInContext'
import _ from 'lodash'
import { getRegionFlag } from 'src/views/wonde/CommonHelpers/featureToggles'

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { loggedIn } = useContext(loggedInContext)

  const [navItems, setNavItems] = useState([])
  useEffect(() => {
    const items = _.chain(navigation)
      .filter((item) => {
        if (item.visiblewithoutlogin === 'false' && !loggedIn.username) {
          return false
        }
        if (item.visiblewithoutlogin === 'true' && loggedIn.username) {
          return false
        }

        if (item.name === 'Login' && loggedIn.username) {
          return false
        }
        if (
          item.school &&
          item.school !== 'all' &&
          'Best Performance School'.toUpperCase() !==
            (loggedIn.schoolName ? loggedIn.schoolName.toUpperCase() : '')
        ) {
          return false
        }
        return true
      })
      .map((item) => {
        delete item.visibleWithoutLogin
        return item
      })
      .value()
    setNavItems(items)
  }, [loggedIn])

  return (
    <CSidebar
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CContainer fluid>
        <CRow>
          <CCol style={{ textAlign: 'center' }}>
            <img src={getRegionFlag()} alt="" width="100" height="70"></img>
          </CCol>
        </CRow>
      </CContainer>

      <CSidebarNav>
        <SimpleBar>
          <AppSidebarNav items={navItems} />
        </SimpleBar>
      </CSidebarNav>
      <CSidebarToggler
        className="d-none d-lg-flex"
        onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
      />
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
