/**************************************************************

    * FILE:         js/scriptures.js                      *
    * AUTHOR:       Chris Pratt                           *
    * DATE:         Winter 2018                           *

    * DESCRIPTION:  Front-end JS code for                 *
    *               Mapping the Scriptures.               *
    *               IS 542, Winter 2018, BYU.             *

**************************************************************/

/*START JSLINT STUFF*/
/*jslint browser: true */
/*global window */
/*property
    books, forEach, fullName, getElementById, gridName, hash, id, init,
    innerHTML, length, location, log, maxBookId, minBookId, numChapters,
    onHashChange, onerror, onload, open, parentBookId, parse, push,
    responseText, send, split, status, substring
*/
/*END JSLINT STUFF*/

const Scriptures = (function () {
    "use strict";
    /*---------------------------------------------------------
                             CONSTANTS
    ---------------------------------------------------------*/

    const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*)\)/;
    const MAX_RETRY_DELAY = 5000;
    const SCRIPTURES_URL = "http://scriptures.byu.edu/mapscrip/mapgetscrip.php";

    /*---------------------------------------------------------
                         PRIVATE VARIABLES
    ---------------------------------------------------------*/

    let books = {};
    let gmMarkers = [];
    let nextprev;
    let requestedBreadcrumbs;
    let retryDelay = 500;
    let volumes = [];

    /*---------------------------------------------------------
                    PRIVATE METHOD DECLARATIONS
    ---------------------------------------------------------*/

    let addMarker;
    let ajax;
    let bookChapterValid;
    let breadcrumbs;
    let cacheBooks;
    let clearMarkers;
    let getNextScriptureCallback;
    let getPreviousScriptureCallback;
    let getScriptureCallback;
    let getScriptureFailed;
    let goHome;
    let goToBook;
    let goToChapter;
    let hash;
    let init;
    let nextChapter;
    let onHashChange;
    let previousChapter;
    let setupMarkers;
    let titleForBookChapter;
    let urlParams;

    /*---------------------------------------------------------
                          PRIVATE METHODS
    ---------------------------------------------------------*/

    addMarker = function (placename, latitude, longitude) {
        let marker = new google.maps.Marker({
            animation: google.maps.Animation.DROP,
            label: {
                fontFamily: "Raleway",
                fontSize: "20px",
                text: placename
            },
            map: map,
            position: {lat: latitude, lng: longitude},
            title: placename
        });
        
        gmMarkers.push(marker);
    };

    ajax = function (url, successCallback, failureCallback, skipParse) {
        let request = new XMLHttpRequest();
        request.open("GET", url, true);

        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                // Success!
                let data;

                if (skipParse) {
                    data = request.responseText;
                } else {
                    data = JSON.parse(request.responseText);
                }

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

    bookChapterValid = function (bookId, chapter) {
        let book = books[bookId];
        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };
    
    breadcrumbs = function (volume, book, chapter) {
        let crumbs;
        
        if (volume === undefined) {
            crumbs = "<ul><li>The Scriptures</li>";
        } else {
            crumbs = "<ul><li><a href=\"javascript:void(0);\" onclick=\"Scriptures.hash()\">The Scriptures</a></li>";
            
            if (book === undefined) {
                crumbs += " > <li>" + volume.fullName + "</li>";
            } else {
                crumbs += " > <li><a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(" + volume.id + ")\">" + volume.fullName + "</a></li>";
                
                if (chapter === undefined || chapter <= 0) {
                    crumbs += " > <li>" + book.tocName + "</li>";
                } else {
                    crumbs += " > <li><a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(0, " + book.id + ")\">" + book.tocName + "</a></li>";
                    crumbs += " > <li>" + chapter + "</li>";
                }
            }
        }
        
        return crumbs + "</ul>";
    }

    cacheBooks = function (callback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };
    
    clearMarkers = function () {
        gmMarkers.forEach(function (marker) {
            marker.setMap(null);
        });
        
        gmMarkers = [];
    };
    
    getNextScriptureCallback = function(chapterHTML) {
        document.getElementsByClassName("next")[0].innerHTML = chapterHTML;  
    }
    
    getPreviousScriptureCallback = function(chapterHTML) {
        document.getElementsByClassName("previous")[0].innerHTML = chapterHTML;
    }

    getScriptureCallback = function (chapterHTML) {
        document.getElementsByClassName("current")[0].innerHTML = chapterHTML;
        document.getElementById("crumb").innerHTML = requestedBreadcrumbs;

        setupMarkers();
    };

    getScriptureFailed = function () {
        console.log("Warning: scripture request from server failed.");
    };

    goHome = function (volumeId) {
        let displayedVolume;
        let navContents = "<div id=\"scripnav\">";

        volumes.forEach(function (volume) {
            if (volumeId === undefined || volume.id === volumeId) {
                navContents += "<div class=\"volume\"><a name=\"v" + volume.id + "\" /><h5>" + volume.fullName + "</h5></a></div><div class=\"books\">";

                volume.books.forEach(function (book) {
                    navContents += "<a class=\"btn\" id=\"" + book.id + "\" href=\"#" + volume.id + ":" + book.id + "\">" + book.gridName + "</a>";
                });
                navContents += "</div>";
                
                if (volume.id === volumeId) {
                    displayedVolume = volume;
                }
            }
        });

        navContents += "<br /><br /></div>";

        document.getElementsByClassName("current")[0].innerHTML = navContents;
        document.getElementById("crumb").innerHTML = breadcrumbs(displayedVolume);
    };

    goToBook = function (bookId) {
        let book = books[bookId];
        if (book.numChapters > 0) {
            let chapters = Array.from(Array(book.numChapters).keys());
            let navContents = "<div id=\"scripnav\"><div class=\"volume\"><h5>" + book.fullName + "</h5></div><div class=\"books\">";

            chapters.forEach(function (chapter) {
                navContents += "<a class=\"chapter\" href=\"#" + book.parentBookId + ":" + book.id + ":" + Number(chapter + 1) + "\">" + (Number(chapter + 1)) + "</a>";
            });

            navContents += "<br /><br /></div></div>"

            document.getElementsByClassName("current")[0].innerHTML = navContents;
        } else {
            goToChapter(bookId, 0);
        }
        document.getElementById("crumb").innerHTML = breadcrumbs(volumes[book.parentBookId - 1], book);
    };

    goToChapter = function (bookId, chapter) {
        if (bookId !== undefined) {
            let book = books[bookId];
            let nextChapterInfo = nextChapter(bookId, chapter);
            let nextChapterContent = "";
            let nextHTML = "";
            let previousChapterInfo = previousChapter(bookId, chapter);
            let previousChapterContent = "";
            let previousHTML = "";
            let volume = volumes[book.parentBookId - 1];

            requestedBreadcrumbs = breadcrumbs(volume, book, chapter);

            ajax(urlParams(bookId, chapter), getScriptureCallback, getScriptureFailed, true);
            
            if (previousChapterInfo) {
                previousHTML = "<a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(0, " + previousChapterInfo[0] + ", " + previousChapterInfo[1] + ", " + true + ", " + false + ")\" title=\"" + previousChapterInfo[2] + "\"><i class=\"material-icons\">skip_previous</i></a>";
                previousChapterContent = ajax(urlParams(previousChapterInfo[0], previousChapterInfo[1]), getPreviousScriptureCallback, getScriptureFailed, true);                
            } else {
                document.getElementsByClassName("previous")[0].innerHTML = "";                
            }
            if (nextChapterInfo) {
                nextHTML = "<a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(0, " + nextChapterInfo[0] + ", " + nextChapterInfo[1] + ", " + false + ", " + true + ")\" title=\"" + nextChapterInfo[2] + "\"><i class=\"material-icons\">skip_next</i></a>";
                nextChapterContent = ajax(urlParams(nextChapterInfo[0], nextChapterInfo[1]), getNextScriptureCallback, getScriptureFailed, true);
            } else {
                document.getElementsByClassName("next")[0].innerHTML = "";
            }
            nextprev = "<div class=\"nextprev\">" + previousHTML + nextHTML + "</div>";
        }

    };
    
    hash = function (volumeId, bookId, chapter, prev, next) {
        let newHash = "";
        
        if (volumeId !== undefined) {
            newHash += volumeId;
            
            if (bookId !== undefined) {
                newHash += ":" + bookId;
                
                if (chapter !== undefined) {
                    newHash += ":" + chapter;
                }
            }
        }
        
        if (next) {
            let arr = [];
            arr[0] = document.getElementById("first").classList[1];
            arr[1] = document.getElementById("second").classList[1];
            arr[2] = document.getElementById("third").classList[1];
            
            document.getElementById("first").classList.remove(arr[0]);
            document.getElementById("second").classList.remove(arr[1]);
            document.getElementById("third").classList.remove(arr[2]);
            
            document.getElementById("first").classList.add(arr[2]);
            document.getElementById("second").classList.add(arr[0]);
            document.getElementById("third").classList.add(arr[1]);
        }
        
        if (prev) {
            let arr = [];
            arr[0] = document.getElementById("first").classList[1];
            arr[1] = document.getElementById("second").classList[1];
            arr[2] = document.getElementById("third").classList[1];

            document.getElementById("first").classList.remove(arr[0]);
            document.getElementById("second").classList.remove(arr[1]);
            document.getElementById("third").classList.remove(arr[2]);
            
            document.getElementById("first").classList.add(arr[1]);
            document.getElementById("second").classList.add(arr[2]);
            document.getElementById("third").classList.add(arr[0]);
        }
        
        location.hash = newHash;
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

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
    };

    nextChapter = function (bookId, chapter) {
        let book = books[bookId];
        
        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [bookId, chapter + 1, titleForBookChapter(book, chapter + 1)];
            }
            
            let nextBook = books[bookId + 1];
            
            if (nextBook !== undefined) {
                let nextChapterValue = 0;
                
                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }
                
                return [nextBook.id, nextChapterValue, titleForBookChapter(nextBook, nextChapterValue)];
            }
        }
    };

    onHashChange = function () {
        let bookId;
        let chapter;
        let hash = window.location.hash;
        let ids = [];
        let volumeId;

        if (hash !== "" && hash.length > 1) {
            // Remove leading pound sign and split on colons
            ids = hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            document.getElementsByClassName("current")[0].setAttribute("name", "");
            void document.getElementsByClassName("current")[0].offsetWidth;
            document.getElementsByClassName("current")[0].setAttribute("name", "fade");
            // Go to the homepage if no book or volume is specified
            goHome();
        } else if (ids.length === 1) {
            volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes[volumes.length - 1].id) {
                goHome();
            } else {
                document.getElementsByClassName("current")[0].setAttribute("name", "");
                void document.getElementsByClassName("current")[0].offsetWidth;
                document.getElementsByClassName("current")[0].setAttribute("name", "fade");
                // Display volume - list of books
                goHome(volumeId);
            }
        } else if (ids.length === 2) {
            document.getElementsByClassName("current")[0].setAttribute("name", "");
            void document.getElementsByClassName("current")[0].offsetWidth;
            document.getElementsByClassName("current")[0].setAttribute("name", "fade");
            // Display book - list of chapters
            bookId = Number(ids[1]);
            if (books[bookId] === undefined) {
                goHome();
            } else {
                goToBook(bookId);
            }
        } else {
            // Display chapter contents
            document.getElementsByClassName("current")[0].setAttribute("name", "");
            bookId = Number(ids[1]);
            chapter = Number(ids[2]);

            if (!bookChapterValid(bookId, chapter)) {
                goHome();
            } else {
                goToChapter(bookId, chapter);
            }
        }
        
        clearMarkers();
    };

    previousChapter = function (bookId, chapter) {
        let book = books[bookId];
        
        if (book !== undefined) {
            if (chapter > 1) {
                return [bookId, chapter - 1, titleForBookChapter(book, chapter - 1)];
            }
            
            let previousBook = books[bookId - 1];
            
            if (previousBook !== undefined) {
                let previousChapterValue = 0;
                
                if (previousBook.numChapters > 0) {
                    previousChapterValue = previousBook.numChapters;
                }
                
                return [previousBook.id, previousChapterValue, titleForBookChapter(previousBook, previousChapterValue)];
            }
        }
    };

    setupMarkers = function () {
        if (window.google === undefined) {
            let retryId = window.setTimeout(setupMarkers, retryDelay);
            
            retryDelay += retryDelay;
            
            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }
            
            return;
        }
        
        if (gmMarkers.length > 0) {
            clearMarkers();
        }
        
        let matches;
        
        document.querySelectorAll(".current a[onclick^=\"showLocation(\"]").forEach(function (element) {
            let value = element.getAttribute("onclick");
            
            matches = LAT_LON_PARSER.exec(value);
            
            if (matches) {
                let placename = matches[2];
                let latitude = Number(matches[3]);
                let longitude = Number(matches[4]);
                let flag = matches[11].substring(1);
                
                flag = flag.substring(0, flag.length - 1);
                
                if (flag !== "") {
                    placename += " " + flag;
                }
                addMarker(placename, latitude, longitude);
            }
        });
        
        if (gmMarkers.length !== 0) {
            let bounds = new google.maps.LatLngBounds();
            gmMarkers.forEach(function (marker) {
                bounds.extend(marker.getPosition());
            });

            map.fitBounds(bounds);
            if (map.getZoom() > 15) {
                map.setZoom(15);
            }
        }
        
        document.getElementsByClassName("navheading")[0].innerHTML += nextprev;
        document.getElementsByClassName("navheading")[1].innerHTML += nextprev;
        document.getElementsByClassName("navheading")[2].innerHTML += nextprev;
        document.getElementsByClassName("navheading")[3].innerHTML += nextprev;
        document.getElementsByClassName("navheading")[4].innerHTML += nextprev;
        document.getElementsByClassName("navheading")[5].innerHTML += nextprev;  
    };

    titleForBookChapter = function (book, chapter) {
        return book.tocName +
            (chapter > 0 ? " " + chapter : "");
    };

    urlParams = function (bookId, chapter, verses, isJst) {
        let options = "";
        if (bookId !== undefined && chapter !== undefined) {
            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined && isJst) {
                options += "&jst=JST";
            }

            return SCRIPTURES_URL + "?book=" + bookId + "&chap=" + chapter + "&verses" + options;
        }
    };

    /*---------------------------------------------------------
                            PUBLIC API
    ---------------------------------------------------------*/

    return {
        hash: hash,
        init: init,
        onHashChange: onHashChange
    };

}());