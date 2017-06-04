import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';

import { BsDropdownModule, CollapseModule, PaginationModule } from 'ngx-bootstrap';
import { ClipboardModule } from 'ngx-clipboard';

import { AccordionModule } from './accordion/accordion.module';

import { HeaderComponent } from './header/header.component';
import { TableComponent } from './table/table.component';

@NgModule({
  imports: [
    CommonModule,
  ],
  declarations: [
    HeaderComponent,
    TableComponent
  ],
  exports: [
    CommonModule,
    HttpModule,
    FormsModule,
    BsDropdownModule,
    CollapseModule,
    PaginationModule,
    ClipboardModule,
    AccordionModule,
    HeaderComponent,
    TableComponent
  ]
})
export class SharedModule { }