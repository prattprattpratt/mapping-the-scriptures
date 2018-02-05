/**************************************************************

    * FILE:         js/scriptures.js                      *
    * AUTHOR:       Chris Pratt                           *
    * DATE:         Winter 2018                           *

    * DESCRIPTION:  Front-end JS code for                 *
    *               Mapping the Scriptures.               *
    *               IS 542, Winter 2018, BYU.             *

**************************************************************/
/*global window */
/*jslint browser: true */
/*property
    MaxBookId, books, forEach, init, minBookId, onerror, onload, open, parse,
    push, responseText, send, status
*/

const Scriptures = (function () {
    "use strict";
    /*---------------------------------------------------------
                             CONSTANTS
    ---------------------------------------------------------*/

    /*---------------------------------------------------------
                         PRIVATE VARIABLES
    ---------------------------------------------------------*/

    let books = {};
    let volumes = [];

    /*---------------------------------------------------------
                    PRIVATE METHOD DECLARATIONS
    ---------------------------------------------------------*/
    
    let ajax;
    let cacheBooks;
    let init;
    
    /*---------------------------------------------------------
                          PRIVATE METHODS
    ---------------------------------------------------------*/

    ajax = function (url, successCallback, failureCallback) {
        let request = new XMLHttpRequest();
        request.open("GET", url, true);

        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                // Success!
                let data = JSON.parse(request.responseText);

                if (typeof successCallback === "function") {
                    successCallback(data);
                }
            } else {
                // We reached our target server, but it returned an error
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };
        request.onerror = failureCallback;

        request.send();
    };

    cacheBooks = function (callback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.MaxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };
    
    function goHome() {
        let html = "<div>The Old Testament</div><div>The New Testament</div>";
        document.getElementById("scriptures").innerHTML = html;
    }
    
    function onHashChanged() {
        let ids = [];
        let hash = window.location.hash;

        if (hash !== "" && hash.length > 1) {
            ids = hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            goHome();
        } else {

        }
    }
    
    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax(
            "http://scriptures.byu.edu/mapscrip/model/books.php",
            function (data) {
                books = data;
                booksLoaded = true;

                if (volumesLoaded) {
                    cacheBooks(callback);
                }
            }
        );
        ajax(
            "http://scriptures.byu.edu/mapscrip/model/volumes.php",
            function (data) {
                volumes = data;
                volumesLoaded = true;

                if (booksLoaded) {
                    cacheBooks(callback);
                }
            }
        );
    };

    /*---------------------------------------------------------
                            PUBLIC API
    ---------------------------------------------------------*/

    return {
        init: init
    };
    
}());