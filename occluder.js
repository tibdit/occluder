/*
occluder.js

hides specified DOM content and data, while preserving general layout

Copyright (C) 2016 tibit / Justin Maxwell (hello@tibit.com)

    This program is free software: you can redistribute it and/or modify it under the 
    terms of the GNU General Public License as published by the Free Software Foundation,
    either version 3 of the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY
    WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A 
    PARTICULAR PURPOSE.  See the GNU General Public License for more details.

    The GNU General Public License text is available at http://www.gnu.org/licenses/
*/



// TODO require.js and include jQuery alternative if required.

/*jslint browser: true, jquery: true, devel: true, strict: true */


var Occluder= (function() { 
	"use strict";

	var publ= {};  // container for returned public objects

	var CONST= { 
		textClass: '_occluded-text',
		linkClass: '_occluded-link',
		displayClass: '_occluded-display',
		cssId: '_occluder-css'
	};

	var fetchCss= true;

	var occludedTextNodes= [];
	var occludedLinks= [];
	var occludedData= [];
	var occludedClasses= [];
	var displayElements= [];

	var afterReveal;

	// worker functions
	var occludeType= {
		text:  occludeText,
		link:  occludeLinks,
		class: occludeClasses,
		data:  occludeData,
		display:  displayElement
		// TODO control disabler
	};

	if ( !document.getElementById( CONST.cssId) && fetchCss) {
		loadCss('http://play.local/signing/occluder.css');
	}



	function occlude( control) {

		var containers;

		containers= $( control.containerSelector);
		containers.css('visibility', 'hidden');

		if ( control.styles !== false) injectCss( control.styles);

		$(containers).each( function( i) {
			var container= this;
			$.each(control.actions, function( j) {
				occludeType[this.type]( this, container);
			});
		});

		afterReveal= control.afterReveal;
		try { control.afterOcclude(); }  catch(e) {}

		containers.css('visibility', 'visible');

		return( reveal);

		// TODO standard set of default actions.  text, link, controls, display.
	}




	function reveal() {

		hideDisplayElements();

		revealText();
		revealLinks();
		revealData();
		revealClasses();

		try { afterReveal(); }  catch(e) {}
	}



	function displayElement( action, container) {

		// move and display elements to be shown only while occluded

		var display= document.getElementById( action.id);
		var before=$( action.after, container)[0].nextSibling;
		container.insertBefore( display, before);
		$(display).slideDown();
		displayElements.push( display);

		// TODO null move
	}



	function hideDisplayElements() {

		// hide elements shown only while occluded

		$(displayElements).each( function( i) {
			$(this).slideUp();
		});
	}



	function injectCss( url) {
		if( !document.getElementById( CONST.cssId)) {
			var style;
			if (url) {
			
				style=document.createElement("link");
			    style.setAttribute("rel", "stylesheet");
				style.setAttribute("href", url);
			
			} else {
			
				style= document.createElement('style');
				style.appendChild(document.createTextNode("")); // webkit
				var rule;		
				rule+="._occluded-text, ._occluded-text * {";
				rule+="    text-shadow: 0px 0px 6px black, 0px 0px 8px black, 0px 0px 10px black, 0px 0px 12px black, 0px 0px 14px black, 0px 0px 16px black !important;";
				rule+="    color: rgba(0,0,0,0) !important; ";
				rule+="    text-decoration: none !important; }";
				style.insertRule( rule);
			}

			style.setAttribute("type", "text/css");
			style.setAttribute("id", CONST.cssId);
			document.head.appendChild(style);
		} 
	}


	function occludeText( action, container) {

		// replace text nodes with dummy content
		// eg: { action: 'text', selector: 'P, TD', with: '-' }
		
		var list= $( action.selector, container);

		$(list).each( function( i) {
			var noder= document.createNodeIterator( this, NodeFilter.SHOW_TEXT);
			var node;

			while (( node= noder.nextNode() )) {
				occludedTextNodes.push( { node: node, content: node.textContent } );
				node.textContent= node.textContent.replace(/[^ ]/gi, action.with);
				$(node).parent().addClass(CONST.textClass);
			}
			
		});

		// TODO default selector: to 'P', with: to '-'
	}

	function revealText( ) {

		var item;

		while (( item= occludedTextNodes.pop() )) {
			item.node.textContent= item.content;
			$(item.node).parent().removeClass(CONST.textClass);
		}
	}



	function occludeLinks( action, container) {   

		// replace href attribute with null url
		// eg: { action: 'link', selector: 'A', with: '#' }

		var list= $( action.selector, container);

		list.each( function( i) {
			if (this.href && this.href[0] !== '#') {
				occludedLinks.push( { element: this, link: this.href } );
				$(this).attr('href', action.with);
				$(this).addClass( CONST.linkClass);
			}
		});	

		// TODO form action, control formaction links
		// TODO default selector: to 'A, FORM', with: to '#'
	}

	function revealLinks() {

		var item;

		while (( item= occludedLinks.pop() )) {
			item.element.href= item.link;
			$(item).removeClass( CONST.linkClass);
		}
	}



	function occludeClasses( action, container) {

		// remove specified classes, and add specified single class
		// eg: { action: 'class' selector: '.graph', remove: 'graph', with: 'hidden-graph' }

		var list= $( action.selector, container);
		var classes= [], removed= "", add= "";

		list.each( function( i) {
			var $this=$(this);

			classes= action.classes.split(' ');
			removed= $(this.classList).filter( classes).get().join(' ');
			add= $this.hasClass(action.with) ? '' : action.with;

			occludedClasses.push( { element: this, classes: removed, reset: add });

			$this.removeClass( removed);
			$this.addClass( add);
		});

		// TODO default remove: to selector: classes, with: to '_occluded-class'
	}

	function revealClasses() {

		var item;

		while (( item= occludedClasses.pop() )) {
			var $this=$(item.element);

			$this.addClass( item.classes);
			$this.removeClass( item.reset);
		}
	}



	function occludeData( action, container) {

		// recurse into arrays and objects, replace values in deepest key-value pairs with placeholder data, except for specified keys
		// eg: { action: 'data', [ array1, array2 ], keys: [ 'year', 'category' ] 

		recursiveOccludeArrayData( action.arrays );

		function recursiveOccludeArrayData( a, key, parent) {
			if ( typeof a === 'object' ) {
				$.each( a, function( i) { 
					recursiveOccludeArrayData( this, i, a);
				});
			}
			else {
				if ( $.inArray( key, action.keys) === -1 ) {
					occludedData.push( { object: parent, key: key, value: a });
					parent[key]="";
				}
			}
		}

		// TODO default keys: to empty
	}

	function revealData() {

		var item;

		while (( item= occludedData.pop() )) {
			item.object[item.key]= item.value;
		}
	}



	publ.occlude= occlude;

	return publ;


}());


