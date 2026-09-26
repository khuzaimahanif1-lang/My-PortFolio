import { Component, Input, OnChanges } from '@angular/core';
import { provideCharts,withDefaultRegisterables,BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { Report } from '../core/models';
@Component({selector: 'app-charts', imports: [BaseChartDirective], providers: [provideCharts(withDefaultRegisterables())], template: `
  <div class="charts-grid">
    <section class="panel chart-panel"><div class="panel-title"><div><span class="eyebrow">MOMENTUM</span><h3>Activity over time</h3></div><span class="subtle">{{report?.monthly?.length || 0}} months</span></div>
      <div class="chart-wrap"><canvas baseChart [data]="activity" [options]="lineOptions" type="line" aria-label="Monthly workspace activity"></canvas></div></section>
    <section class="panel chart-panel"><div class="panel-title"><div><span class="eyebrow">YOUR TOOLKIT</span><h3>Technology mix</h3></div><span class="subtle">Project usage</span></div>
      @if (report?.technologies?.length) { <div class="chart-wrap"><canvas baseChart [data]="technology" [options]="donutOptions" type="doughnut" aria-label="Technology distribution"></canvas></div> }
      @else { <div class="chart-empty">Add technologies to your projects to see the mix.</div> }</section>
    @if (expanded) {
      <section class="panel chart-panel"><div class="panel-title"><div><span class="eyebrow">CONTINUOUS GROWTH</span><h3>Learning & completion</h3></div></div>
        <div class="chart-wrap"><canvas baseChart [data]="learning" [options]="lineOptions" type="bar" aria-label="Learning hours and task completion"></canvas></div></section>
      <section class="panel chart-panel"><div class="panel-title"><div><span class="eyebrow">WORK IN MOTION</span><h3>Project status</h3></div></div>
        @if (status.labels?.length) { <div class="chart-wrap"><canvas baseChart [data]="status" [options]="donutOptions" type="doughnut" aria-label="Project status"></canvas></div> }
        @else { <div class="chart-empty">Your first project starts the story.</div> }</section>
    }
  </div>`})
export class Charts implements OnChanges {
  @Input() report: Report | null = null; @Input() expanded = false;
  activity: ChartConfiguration['data'] = {labels: [], datasets: []};
  technology: ChartConfiguration['data'] = {labels: [], datasets: []};
  learning: ChartConfiguration['data'] = {labels: [], datasets: []};
  status: ChartConfiguration['data'] = {labels: [], datasets: []};
  colors = ['#d7ad5d', '#8da7c8', '#927ec2', '#64a99d', '#c2796c', '#a6b269'];
  lineOptions: ChartConfiguration['options'] = {responsive: true, maintainAspectRatio: false,
    plugins: {legend: {position: 'bottom', labels: {color: '#89929e', usePointStyle: true, padding: 24}}},
    scales: {x: {grid: {display: false}, ticks: {color: '#89929e'}}, y: {beginAtZero: true, grid: {color: '#ffffff08'}, ticks: {color: '#89929e', precision: 0}}},
    interaction: {intersect: false, mode: 'index'}};
  donutOptions: ChartConfiguration['options'] = {responsive: true, maintainAspectRatio: false, cutout: '76%',
    plugins: {legend: {position: 'right', labels: {color: '#a2a8b1', usePointStyle: true, padding: 18}}}} as any;
  ngOnChanges() {
    if (!this.report) return;
    const r = this.report;
    this.activity = {labels: r.monthly.map(m => m.label), datasets: [
      {label: 'Activity', data: r.monthly.map(m => m.activity), borderColor: '#d7ad5d', backgroundColor: '#d7ad5d12', fill: true, tension: 0.35, pointRadius: 4},
      {label: 'Projects created', data: r.monthly.map(m => m.projects), borderColor: '#8da7c8', tension: 0.35, pointRadius: 3}]};
    this.technology = {labels: r.technologies.map(t => t.name), datasets: [{data: r.technologies.map(t => t.count), backgroundColor: this.colors, borderWidth: 0}]};
    this.learning = {labels: r.monthly.map(m => m.label), datasets: [
      {label: 'Learning hours', data: r.monthly.map(m => m.learning_minutes / 60), backgroundColor: '#d7ad5d', borderRadius: 4},
      {label: 'Completed tasks', data: r.monthly.map(m => m.completed_tasks), backgroundColor: '#8da7c8', borderRadius: 4}]};
    this.status = {labels: Object.keys(r.project_status).map(s => s.replaceAll('_', ' ')), datasets: [{data: Object.values(r.project_status), backgroundColor: this.colors, borderWidth: 0}]};
  }
}

