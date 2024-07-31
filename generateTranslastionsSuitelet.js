/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(["N/ui/serverWidget", "N/config", "N/https", "N/xml", "N/query", "N/redirect"], function (serverWidget, config, https, xml, query, redirect) {
    function onRequest(context) {
        if (context.request.method === "GET") {
            const { custpage_input_phrases } = context.request.parameters;
            const Form = serverWidget.createForm({
                title: "Translate Generator",
                hideNavBar: false
            });

            const phrasesField = Form.addField({
                id: "custpage_input_phrases",
                label: "frases a traducir",
                type: serverWidget.FieldType.LONGTEXT
            });
            if (custpage_input_phrases) {
                phrasesField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.DISABLED
                });
            } else {
                phrasesField.defaultValue = `[{key:'soy_un_id',text:'Hola Mundo'}]`;
            }
            const instanceLanguages = getInstanceLanguages(context);
            instanceLanguages.push("en_US");

            const mainLanguageField = Form.addField({
                id: "custpage_input_main_language",
                label: "Idioma Principal",
                type: serverWidget.FieldType.SELECT
            });

            mainLanguageField.addSelectOption({
                value: "en_US",
                text: "English (US)",
                isSelected: true
            });
            mainLanguageField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            const otherLanguaguesField = Form.addField({
                id: "custpage_others_languages",
                label: "Otros idiomas",
                type: serverWidget.FieldType.MULTISELECT
            });
            getLanguages().forEach((langInfo) => {
                if (instanceLanguages.includes(langInfo.deflocale)) otherLanguaguesField.addSelectOption({ value: langInfo.deflocale, text: langInfo.descr, isSelected: true });
            });
            otherLanguaguesField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });
            const collectionsField = Form.addField({
                id: "custpage_collection",
                label: "Collections Padre",
                type: serverWidget.FieldType.SELECT
            });
            collectionsField.addSelectOption({
                value: "",
                text: ""
            });
            getCollections(context).forEach((collectionData) => {
                collectionsField.addSelectOption({
                    value: collectionData.value,
                    text: collectionData.text
                });
            });
            collectionsField.isMadatory = true;
            const Sublist = Form.addSublist({
                id: "custlist_phrases",
                label: "Frases a traducir",
                type: "list"
            });
            Sublist.addField({ id: "list_id", label: "KEY", type: "text" });
            Sublist.addField({ id: "list_label", label: "TEXT", type: "text" });
            instanceLanguages.forEach((language) => {
                const auxField = Sublist.addField({ id: `list_label_${language.toLowerCase()}`, label: language, type: "text" });
                auxField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.ENTRY
                });
                auxField.isMandatory = true;
            });

            if (custpage_input_phrases) {
                const data = JSON.parse(custpage_input_phrases);
                let counterLine = 0;
                data?.forEach((dataItem, index) => {
                    if (dataItem?.key && dataItem?.text) {
                        // data[index].translations = [];
                        instanceLanguages.forEach((language) => {
                            const translate = https.get(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${language}&q=${dataItem?.text}`);
                            const translation = JSON.parse(translate.body)[0][0][0];

                            Sublist.setSublistValue({
                                id: `list_label_${language.toLowerCase()}`,
                                line: counterLine,
                                value: translation
                            });
                            // data[index].translations.push({ language, translation });
                        });
                        Sublist.setSublistValue({
                            id: "list_id",
                            line: counterLine,
                            value: dataItem?.key
                        });
                        Sublist.setSublistValue({
                            id: "list_label",
                            line: counterLine,
                            value: dataItem?.text
                        });
                        counterLine++;
                    }
                });
                phrasesField.defaultValue = JSON.stringify(data);
            }
            const clientField = Form.addField({
                id: "custpage_client",
                label: "client",
                type: serverWidget.FieldType.INLINEHTML
            });
            clientField.defaultValue = `<script >${procesar}
            ${generar}
            </script>
            <script type='module'>
            import { jsonrepair } from 'https://cdn.jsdelivr.net/npm/jsonrepair/+esm'
                window.jsonrepair=jsonrepair
            
            </script>
                `;
            if (custpage_input_phrases) {
                Form.addButton({
                    id: "cust_button_generar",
                    label: "Generar",
                    functionName: "generar"
                });
            } else {
                Form.addButton({
                    id: "cust_button_procesar",
                    label: "Procesar",
                    functionName: "procesar"
                });
            }

            context.response.writePage(Form);
        } else {
            redirect.toSuitelet({
                scriptId: "customscript4229",
                deploymentId: "customdeploy1",
                isExternal: false,
                parameters: context.request.parameters
            });
        }
    }
    function procesar() {
        try {
            // eslint-disable-next-line no-undef
            const inputFrases = nlapiGetFieldValue("custpage_input_phrases");
            // eslint-disable-next-line no-undef
            const frasesParseadas = JSON.parse(jsonrepair(inputFrases));
            // eslint-disable-next-line no-undef
            nlapiSetFieldValue("custpage_input_phrases", JSON.stringify(frasesParseadas), true, true);
            document.main_form.submit();
        } catch (error) {
            alert("error al parsear entrada, revise su log para mas informacion");
            console.error(error);
        }
    }
    function generar() {
        // eslint-disable-next-line no-undef
        const languages = nlapiGetFieldValues("custpage_others_languages");
        // eslint-disable-next-line no-undef
        const nroLines = nlapiGetLineItemCount("custlist_phrases");

        // eslint-disable-next-line no-undef
        const custcollection = nlapiGetFieldValue("custpage_collection");

        for (let index = 0; index < nroLines; index++) {
            const customBody = [];
            // eslint-disable-next-line no-undef
            const key = nlapiGetLineItemValue("custlist_phrases", "list_id", index);
            languages.forEach((lang) => {
                // eslint-disable-next-line no-undef
                const translation = nlapiGetLineItemValue("custlist_phrases", `list_label_${lang.toLowerCase()}`, index);
                customBody.push({
                    language: lang,
                    translation
                });
            });
            console.debug(key, custcollection, customBody);
            fetch(`https://tstdrv2570728.app.netsuite.com/translations/v1/collections/${custcollection}/terms?_=`, {
                headers: {
                    "accept": "*/*",
                    "accept-language": "es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5,es-PE;q=0.4",
                    "cache-control": "no-cache",
                    "content-type": "application/json",
                    "priority": "u=1, i",
                    // eslint-disable-next-line quotes
                    "sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
                    "sec-ch-ua-mobile": "?0",
                    // eslint-disable-next-line quotes
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest"
                },
                referrer: "https://tstdrv2570728.app.netsuite.com/app/translations/ui/managetranslations.nl?whence=",
                referrerPolicy: "strict-origin-when-cross-origin",
                body: JSON.stringify({
                    key: key,
                    collectionScriptId: custcollection,
                    translations: customBody
                }),
                method: "POST",
                mode: "cors",
                credentials: "include"
            })
                .then((e) => e.json())
                .then((jo) => console.log(jo));
        }
    }
    function getLanguages() {
        return query
            .runSuiteQL({
                query: `
            SELECT
                Language.descr,
                Language.key,
                Language.inactive,
                Language.deflocale
            FROM
                Language
            WHERE
                Language.inactive = 'F'
            `,
                params: []
            })
            .asMappedResults();
    }
    function getInstanceLanguages(context) {
        const cookiesOriginal = context.request.headers["cookie"];

        const src = https.get({
            url: "https://tstdrv2570728.app.netsuite.com/app/setup/general.nl?whence=&xml=T",
            headers: {
                "accept": "*/*",
                "accept-language": "es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5,es-PE;q=0.4",
                "nsxmlhttprequest": "NSXMLHttpRequest",
                "priority": "u=1, i",
                // eslint-disable-next-line quotes
                "sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
                "sec-ch-ua-mobile": "?0",
                // eslint-disable-next-line quotes
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-site": "same-origin",
                "cookie": cookiesOriginal
            }
        });
        let xmlDocument = xml.Parser.fromString({
            text: src.body
        });

        let preferenceLists = xml.XPath.select({
            node: xmlDocument,
            xpath: "//machine"
        });
        const instanceLanguages = [];
        for (const preferentList of preferenceLists) {
            if (preferentList.getAttribute("name") === "tranlang") {
                preferentList.childNodes.forEach((lang) => instanceLanguages.push(lang.textContent));
            }
        }
        return instanceLanguages;
    }
    function getCollections(context) {
        const cookiesOriginal = context.request.headers["cookie"];

        const src = https.get({
            url: "https://tstdrv2570728.app.netsuite.com/translations/v1/collections?nopagination=true",
            headers: {
                "accept": "*/*",
                "accept-language": "es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5,es-PE;q=0.4",
                "nsxmlhttprequest": "NSXMLHttpRequest",
                "priority": "u=1, i",
                // eslint-disable-next-line quotes
                "sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
                "sec-ch-ua-mobile": "?0",
                // eslint-disable-next-line quotes
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-site": "same-origin",
                "cookie": cookiesOriginal
            }
        });
        const datos = JSON.parse(src.body);
        return datos.data.items
            .map((e) => {
                return { value: e.scriptId, text: e.name };
            })
            .sort((a, b) => a.text?.localeCompare(b.text));
    }

    return {
        onRequest: onRequest
    };
});
