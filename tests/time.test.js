import {describe,it,expect} from 'vitest';
import {nzParts,nzToDate,TIME_OPTIONS,timeLabel,timeOptionsFor} from '../src/time';
import {parseMapInput,mapFields,embedSrc} from '../src/maps';
describe('New Zealand clock',()=>{
 it('turns a NZ date and time into the right instant, in summer and winter',()=>{
  expect(nzToDate('2026-10-12','09:00').toISOString()).toBe('2026-10-11T20:00:00.000Z');   // daylight time, UTC+13
  expect(nzToDate('2026-07-01','09:00').toISOString()).toBe('2026-06-30T21:00:00.000Z');   // standard time, UTC+12
 });
 it('reads the same date and time back, including around the daylight-saving changes',()=>{
  [['2026-01-15','05:30'],['2026-04-04','23:45'],['2026-04-05','01:45'],['2026-04-05','03:30'],['2026-09-26','23:45'],['2026-09-27','03:15'],['2026-09-28','00:15'],['2027-06-30','12:00']]
   .forEach(([date,time])=>expect(nzParts(nzToDate(date,time))).toEqual({date,time}));
 });
});
describe('time list',()=>{
 it('has every 15 minutes in 12-hour form',()=>{
  expect(TIME_OPTIONS).toHaveLength(96);
  expect([TIME_OPTIONS[0],TIME_OPTIONS[30],TIME_OPTIONS[48],TIME_OPTIONS[95]]).toEqual([{v:'00:00',l:'12:00 am'},{v:'07:30',l:'7:30 am'},{v:'12:00',l:'12:00 pm'},{v:'23:45',l:'11:45 pm'}]);
  expect(timeLabel('13:05')).toBe('1:05 pm');
 });
 it('keeps an older time that is not on the grid, in order',()=>{
  const o=timeOptionsFor('06:10');expect(o).toHaveLength(97);expect(o.findIndex(x=>x.v==='06:10')).toBe(o.findIndex(x=>x.v==='06:00')+1);
  expect(timeOptionsFor('06:15')).toBe(TIME_OPTIONS);
 });
});
describe('Google Maps input',()=>{
 it('accepts coordinates',()=>{
  expect(parseMapInput('-41.2865, 174.7762')).toEqual({mapUrl:'https://www.google.com/maps?q=-41.2865,174.7762',lat:-41.2865,lng:174.7762,error:''});
  expect(parseMapInput('-39.05 175.9')).toMatchObject({lat:-39.05,lng:175.9});
  expect(parseMapInput('95, 10').error).toMatch(/out of range/);
 });
 it('accepts Google Maps links and finds the coordinates when they are in the link',()=>{
  expect(parseMapInput('https://www.google.com/maps/place/Lake+Taupo/@-38.8,175.9,12z/data=!3m1').lat).toBe(-38.8);
  expect(parseMapInput('https://www.google.com/maps/place/X/data=!4m2!3d-38.81!4d175.92')).toMatchObject({lat:-38.81,lng:175.92});
  expect(parseMapInput('https://www.google.com/maps?q=-38.81,175.92')).toMatchObject({lat:-38.81,lng:175.92});
  expect(parseMapInput('https://www.google.co.nz/maps/search/boat+ramp')).toMatchObject({lat:null,lng:null,error:''});
  const short=parseMapInput('https://maps.app.goo.gl/abc123');expect(short).toMatchObject({mapUrl:'https://maps.app.goo.gl/abc123',lat:null,error:''});
 });
 it('refuses anything that is not a Google Maps link',()=>{
  ['https://evil.com/maps/x','https://google.com.evil.com/maps/x','http://www.google.com/maps/x','javascript:alert(1)','https://www.google.com/search?q=maps','just some words','ftp://maps.app.goo.gl/x']
   .forEach(x=>expect(parseMapInput(x).error,x).not.toBe(''));
  expect(parseMapInput('https://www.google.com/maps/'+'a'.repeat(1000)).error).toMatch(/too long/);
 });
 it('treats empty as no location and builds the saved fields',()=>{
  expect(parseMapInput('  ')).toEqual({mapUrl:'',lat:null,lng:null,error:''});expect(mapFields('')).toEqual({mapUrl:'',lat:null,lng:null});
  expect(embedSrc(-41.2,174.7)).toBe('https://maps.google.com/maps?q=-41.2,174.7&z=14&output=embed');
 });
});
