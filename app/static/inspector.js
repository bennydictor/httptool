window.addEventListener("load", function() {
    document.getElementById("rqPort").addEventListener("change", function (event) { event.target.setCustomValidity(""); });
    document.getElementById("rqMethod").addEventListener("change", function (event) { event.target.setCustomValidity(""); });
    document.getElementById("rqPath").addEventListener("change", function (event) { event.target.setCustomValidity(""); });
    document.getElementById("rqEncoding").addEventListener("change", function (event) { event.target.setCustomValidity(""); });
    document.getElementById("rqBody").addEventListener("change", function (event) { event.target.setCustomValidity(""); });

    function onSchemeChange() {
        if (rqScheme.value == "http")
            rqPort.value = "80";
        else if (rqScheme.value == "https")
            rqPort.value = "443";
    }
    var rqScheme = document.getElementById("rqScheme");
    var rqPort = document.getElementById("rqPort");
    rqScheme.addEventListener("change", onSchemeChange);
    onSchemeChange();

    function onLastHeaderChange(event) {
        event.target.setCustomValidity("");

        var formRow = event.target.parentNode.parentNode;
        var formRowHeader = formRow.querySelector(".rqHeader");
        var formRowHeaderValue = formRow.querySelector(".rqHeaderValue");

        var newRow = formRow.cloneNode(true);
        var newRowHeader = newRow.querySelector(".rqHeader");
        var newRowHeaderValue = newRow.querySelector(".rqHeaderValue");

        formRow.parentNode.insertBefore(newRow, formRow.nextElementSibling);

        formRowHeader.removeEventListener("input", onLastHeaderChange);
        formRowHeaderValue.removeEventListener("input", onLastHeaderChange);

        formRowHeader.addEventListener("input", onHeaderChange);
        formRowHeaderValue.addEventListener("input", onHeaderChange);

        newRowHeader.addEventListener("input", onLastHeaderChange);
        newRowHeaderValue.addEventListener("input", onLastHeaderChange);

        newRowHeader.value = "";
        newRowHeaderValue.value = "";

        lastRow = newRow;
    }
    function onHeaderChange(event) {
        event.target.setCustomValidity("");

        var formRow = event.target.parentNode.parentNode;
        var formRowHeader = formRow.querySelector(".rqHeader");
        var formRowHeaderValue = formRow.querySelector(".rqHeaderValue");

        if (formRowHeader.value == "" && formRowHeaderValue.value == "") {
            formRow.parentNode.removeChild(formRow);
            if (event.target == formRowHeader) {
                lastRow.querySelector(".rqHeader").focus();
            } else {
                lastRow.querySelector(".rqHeaderValue").focus();
            }
        }
    }
    var lastRow = document.querySelector(".rqHeaderRow");
    lastRow.querySelector(".rqHeader").addEventListener("input", onLastHeaderChange);
    lastRow.querySelector(".rqHeaderValue").addEventListener("input", onLastHeaderChange);

    rqSubmit = document.getElementById("rqSubmit");
    function onSubmit(event) {
        var request = {};
        request["scheme"] = document.getElementById("rqScheme").value;
        request["host"] = document.getElementById("rqHost").value;
        request["port"] = parseInt(document.getElementById("rqPort").value);
        request["method"] = document.getElementById("rqMethod").value;
        request["path"] = document.getElementById("rqPath").value;
        request["headers"] = [];
        for (formRow of document.querySelectorAll(".rqHeaderRow")) {
            var formRowHeader = formRow.querySelector(".rqHeader");
            var formRowHeaderValue = formRow.querySelector(".rqHeaderValue");
            if (formRowHeader.value != "") {
                request["headers"].push({
                    "header": formRowHeader.value,
                    "value": formRowHeaderValue.value,
                });
            }
        }
        request["body"] = {
            "data": document.getElementById("rqBody").value,
            "encoding": document.getElementById("rqEncoding").value,
        }

        rqSubmit.disabled = true;
        var loadingTimeout = setTimeout(function () {
            for (c of document.querySelectorAll(".rsContainer")) {
                c.style.display = "none";
            }
            document.getElementById("rsContainerLoading").style.display = "initial";
        }, 500);
        function rsContainerShow(elId) {
            rqSubmit.disabled = false;
            clearTimeout(loadingTimeout);
            for (c of document.querySelectorAll(".rsContainer")) {
                c.style.display = "none";
            }
            document.getElementById(elId).style.display = "initial";
        }

        fetch(document.location + "api", {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "body": JSON.stringify(request)
        }).then(function (res) {
            if (res.headers.get("Content-Type") != "application/json") {
                throw [{"error": "alert", "message": "Error while processing request: " + res.status + " " + res.statusText}];
            }
            return res.json();
        }).then(function (response) {
            if (response["status"] == "error") {
                throw response["errors"];
            }

            document.getElementById("rsStatusCode").value = response["status_code"];
            document.getElementById("rsStatusLine").value = response["status_line"];

            for (h of document.querySelectorAll(".rsHeaderRow")) {
                h.parentNode.removeChild(h);
            }
            var rsHeaderRowTemplate = document.getElementById("rsHeaderRowTemplate");
            for (h of response["headers"]) {
                var newHeaderRow = rsHeaderRowTemplate.content.querySelector('div').cloneNode(true);
                newHeaderRow.classList.add("rsHeaderRow");
                newHeaderRow.querySelector(".rsHeader").value = h["header"];
                newHeaderRow.querySelector(".rsHeaderValue").value = h["value"];
                rsHeaderRowTemplate.parentNode.insertBefore(newHeaderRow, rsHeaderRowTemplate);
            }

            document.getElementById("rsBody").value = response["body"]["data"];
            document.getElementById("rsEncoding").value = response["body"]["encoding"];

            rsContainerShow("rsContainerResponse");
        }).catch(function (err) {
            if (err.constructor != Array) {
                console.log(err);
                err = [{"error": "alert", "message": err.toString()}];
            }

            for (a of document.querySelectorAll(".rsAlert")) {
                a.parentNode.removeChild(a);
            }
            for (e of err) {
                if (e["error"] == "Invalid port") {
                    document.getElementById("rqPort").setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid method") {
                    document.getElementById("rqMethod").setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid path") {
                    document.getElementById("rqPath").setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid header") {
                    document.querySelectorAll(".rqHeader")[e["index"]].setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid header value") {
                    document.querySelectorAll(".rqHeaderValue")[e["index"]].setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid encoding") {
                    document.getElementById("rqEncoding").setCustomValidity(e["error"]);
                } else if (e["error"] == "Invalid body") {
                    document.getElementById("rqBody").setCustomValidity(e["error"]);
                } else {
                    var a = document.createElement("div");
                    a.classList.add("alert");
                    a.classList.add("alert-danger");
                    a.classList.add("row");
                    a.classList.add("rsAlert");
                    if (e["error"] == "alert")
                        a.innerText = e["message"];
                    else
                        a.innerText = e["error"];
                    document.getElementById("rsContainerAlerts").appendChild(a);
                }
            }
            rsContainerShow("rsContainerAlerts");
        });
    }
    rqSubmit.addEventListener("click", onSubmit);
});
