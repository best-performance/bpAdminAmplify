import React from 'react'
import { CCard, CContainer, CRow } from '@coreui/react'
import { DataGrid, SearchPanel, Column, FilterRow } from 'devextreme-react/data-grid'
import { historydata } from './historydata'
function History() {
  return (
    <CContainer>
      <CRow>
        <CCard>
          <DataGrid dataSource={historydata} columnAutoWidth={true}>
            <Column dataField="School"></Column>
            <Column dataField="User"></Column>
            <Column dataField="UploadedDate" dataType="date"></Column>
            <Column dataField="FileName"></Column>
            <FilterRow visible={true} />
            <SearchPanel visible={true} />
          </DataGrid>
        </CCard>
      </CRow>
    </CContainer>
  )
}
export default History
