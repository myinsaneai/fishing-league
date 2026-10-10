import {Component} from 'react';
export default class ErrorBoundary extends Component{
 state={err:null};
 static getDerivedStateFromError(err){return {err}}
 componentDidCatch(err){console.error(err)}
 render(){return this.state.err?<div className="c" role="alert" style={{display:'grid',gap:10}}><h2>Something went wrong</h2><p className="m">Please go back to the start page and try again.</p><a className="p" href="/" style={{justifySelf:'start',textDecoration:'none'}}>Back to start</a></div>:this.props.children}}
