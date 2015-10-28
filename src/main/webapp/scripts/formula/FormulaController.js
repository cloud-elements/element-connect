/**
 * Formula controller for showing the available formula templates and creating formula instances from them
 * @author jjwyse
 */
var FormulaController = BaseController.extend({
    _notifications: null,
    _elementsService: null,
    _cloudElementsUtils: null,
    _application: null,
    _formula: null,
    _formulaInstance: null,
    _maskLoader: null,
    _picker: null,

    init: function($scope, CloudElementsUtils, Application, Formula, FormulaInstance, Notifications, ElementsService, MaskLoader, Picker, $window, $location, $interval, $filter, $route, $mdDialog) {
        var me = this;

        me._notifications = Notifications;
        me._elementsService = ElementsService;
        me._maskLoader = MaskLoader;
        me._cloudElementsUtils = CloudElementsUtils;
        me._application = Application;
        me._formula = Formula;
        me._formulaInstance = FormulaInstance;
        me._picker = Picker;
        me.$window = $window;
        me.$location = $location;
        me.$interval = $interval;
        me.$mdDialog = $mdDialog;
        me._super($scope);
    },

    defineScope: function() {
        var me = this;

        // make sure the user is authenticated
        if(me._application.isSecretsPresent() == false) {
            me.$location.path('/');
            return;
        }

        me.$scope.processtep = 'formula';
        me.$scope.appName = me._application.getApplicationName();
        me.$scope.onSelect = me.onSelect.bind(this);
        me.$scope.onEditFormulaInstance = me.onEditFormulaInstance.bind(this);
        me.$scope.onDeleteFormulaInstance = me.onDeleteFormulaInstance.bind(this);
        me.$scope.cancel = me.cancel.bind(this);
        me.$scope.done = me.done.bind(this);
        me.$scope.formulas = [];
        me.$scope.branding = me._application.getBranding();
        me.$scope.showFormulaInstaces = me._application.isMultipleInstance();
        me.$scope.multipleInstance = me._application.isMultipleInstance();
        me.$scope.refreshFormula = me.refreshFormula.bind(this);
        me.$scope.formulaInstances = {};
        me.$scope.selectedFormula = {};
        me.$scope.instanceTitle = me._application.isInstanceTitle();

        // load the formula templates
        me._maskLoader.show(me.$scope, 'Loading formula templates...');
        me._loadFormulaData();
    },

    defineListeners: function() {
        var me = this;
        me._notifications.addEventListener(bulkloader.events.ERROR, me._handleError.bind(me), me.$scope.$id);
        me._notifications.addEventListener(bulkloader.events.NEW_FORMULA_INSTANCE_CREATED, me._onFormulaInstancesRefresh.bind(me), me.$scope.$id);
    },

    destroy: function() {
        var me = this;
        me._notifications.removeEventListener(bulkloader.events.ERROR, me._handleError.bind(me), me.$scope.$id);
        me._notifications.removeEventListener(bulkloader.events.NEW_FORMULA_INSTANCE_CREATED, me._onFormulaInstancesRefresh.bind(me), me.$scope.$id);
    },

    done: function() {
        var me = this;
        me.$location.path('/');
    },

    cancel: function() {
        var me = this;
        if(me._application.ignoreMapper() == false) {
            me.$location.path('/mapper');
        } else {
            me.$location.path('/');
        }
    },

    _handleLoadError: function(error) {
        // ignore as these can be ignored or 404's
        console.log('Loading error' + error);
    },

    onSelect: function(formulaTemplate) {
        var me = this;
        if(me.$scope.multipleInstance){
                me._createFormulaInstance(formulaTemplate);
        }else{
            if(formulaTemplate.instanceId) {
                me._editFormulaInstance(formulaTemplate.id, formulaTemplate.instanceId);
                angular.element(document.getElementById("instance-"+formulaTemplate.id)).addClass('selectedTarget');
            } else {
                me._createFormulaInstance(formulaTemplate);
            }
        }
    },

    onEditFormulaInstance: function(formulaTemplate, $event) {
        var me = this;

        var formulaId = formulaTemplate.id;
        var formulaInstanceId = formulaTemplate.instanceId;

        me._editFormulaInstance(formulaId, formulaInstanceId);

        $event.preventDefault();
        $event.stopPropagation();
    },

    _editFormulaInstance: function(formulaId, formulaInstanceId) {

    },

    onDeleteFormulaInstance: function(formulaTemplate, $event, instanceId) {
        var me = this;

        if(!me.$scope.multipleInstance){
            var formulaId = formulaTemplate.id;
            var formulaName = formulaTemplate.name;
            var formulaInstanceId = formulaTemplate.instanceId;
        }else{
            var indx = me.$scope.selectedFormula.indexOf(me.$scope.selectedFormula.selected);
            var formulaId = me.$scope.selectedFormula[indx].id;
            var formulaName = me.$scope.selectedFormula[indx].name;
            var formulaInstanceId = instanceId;
        }

        me._deleteFormulaInstance(formulaId, formulaName, formulaInstanceId);

        $event.preventDefault();
        $event.stopPropagation();
    },

    _deleteFormulaInstance: function(formulaId, formulaName, formulaInstanceId) {
        var me = this;

        var confirm = me.$mdDialog.confirm()
            .title('Warning!')
            .content("Are you sure you want to delete your "+me.$scope.instanceTitle+" of the formula: " + formulaName + "?")
            .ok('Yes')
            .cancel('No');

        me.$mdDialog.show(confirm).then(function() {
            //continue
            me.continueDelete(formulaId, formulaName, formulaInstanceId);
        }, function() {
            //Don't do anything
        });
    },

    continueDelete: function(formulaId, formulaName, formulaInstanceId) {
        var me = this;

        me._maskLoader.show(me.$scope, 'Deleting formula instance...');

        me._elementsService.deleteFormulaInstance(formulaId, formulaInstanceId)
            .then(me._handleOnDeleteFormulaInstance.bind(me, formulaName));
    },

    _handleOnDeleteFormulaInstance: function(formulaName) {
        var me = this;
        me._maskLoader.hide();

        angular.element(document.getElementById("instance-"+formulaName.id)).removeClass('highlightingElement');

        // set the instance ID on this formula to be null so the UI doesn't think it still exists and we can create a new one
        for(var i = 0; i < me.$scope.formulas.length; i++) {
            var formula = me.$scope.formulas[i];
            if(formula.name == formulaName) {
                if(!me.$scope.multipleInstance) {
                    formula.instanceId = null;
                }
            }
        }

        me.refreshFormula();
    },

    _handleError: function(event, error) {
        var me = this;
        console.log('In error ' + me.$scope.$id);
        me._maskLoader.hide();

        var confirm = me.$mdDialog.alert()
            .title('Error')
            .content(error)
            .ok('OK');

        me.$mdDialog.show(confirm);
    },

    _createFormulaInstance: function(formulaTemplate) {
        var me = this;
        me._formulaInstance.openCreateFormulaInstance(formulaTemplate);
    },

    _loadFormulaData: function() {
        var me = this;
        me._formula.loadFormulaTemplates().then(me._handleFormulaTemplatesLoaded.bind(me));
    },

    _handleFormulaTemplatesLoaded: function(formulaTemplates) {
        var me = this;
        me._maskLoader.hide();
        console.log("Loaded " + formulaTemplates.length + " formula templates");

        if(me._application.configuration.formulas && me._application.configuration.formulas.length > 0) {
            // if there is a formulas section in the app configuration, then filter out any that are not specified there
            me._filterFormulaTemplates(formulaTemplates);
        } else {
            // if we do NOT have any formulas defined in our app config, then just show all of the formula templates
            me.$scope.formulas = formulaTemplates;
            me.$scope.selectedFormula = formulaTemplates;
            me.$scope.selectedFormula.selected = formulaTemplates[0];
        }

        // add any element instances we already know
        me._addDefaultValuesForConfig();

        // check for existing formula instances
        if(!me.$scope.multipleInstance){
            me._highlightFormulaInstances();
        }else{
            me._findMultipleFormulaInstances(0);
        }
    },

    _highlightFormulaInstances: function() {
        var me = this;

        if(me.$scope.formulas) {
            for(var i = 0; i < me.$scope.formulas.length; i++) {
                var formulaTemplate = me.$scope.formulas[i];
                me._elementsService.findFormulaInstances(formulaTemplate.id).then(
                    me._handleLoadFormulaInstances.bind(me, formulaTemplate),
                    me._handleLoadError.bind(me));
            }
        }
    },

    _findMultipleFormulaInstances: function(index) {
        var me = this;
        if(me.$scope.formulas) {
            var formulaTemplate = me.$scope.formulas[index];
            me._elementsService.findFormulaInstances(formulaTemplate.id).then(
                me._handleLoadFormulaInstances.bind(me, formulaTemplate),
                me._handleLoadError.bind(me));
        }
    },

    _addDefaultValuesForConfig: function() {
        var me = this;

        // go through each config on the formula template, and set default values with our target and source element instances, if possible
        if(me.$scope.formulas) {
            for(var i = 0; i < me.$scope.formulas.length; i++) {
                var formulaTemplate = me.$scope.formulas[i];
                if(formulaTemplate.configuration) {
                    for(var k = 0; k < formulaTemplate.configuration.length; k++) {
                        var formulaTemplateConfig = formulaTemplate.configuration[k];
                        if(formulaTemplateConfig.type === 'elementInstance') {
                            var configKey = formulaTemplateConfig.key;
                            var elementKey = configKey.substr(0, configKey.indexOf('.'));
                            console.log("Looking for source or target instance with key: " + elementKey);

                            if(me._picker.selectedElementInstance.element.key === elementKey) {
                                formulaTemplateConfig.defaultValue = me._picker.selectedElementInstance.id;
                            } else if(me._picker.targetElementInstance.element.key === elementKey) {
                                formulaTemplateConfig.defaultValue = me._picker.targetElementInstance.id;
                            }
                        }
                    }
                }
            }
        }
    },

    _handleLoadFormulaInstances: function(formulaTemplate, httpResult) {
        var me = this;

        var formulaInstances = httpResult.data;

        // Handle multiple Instance
        if (!me.$scope.multipleInstance){
            // limiting the formula to only have one instance
            if(formulaInstances && formulaInstances.length > 0) {
                formulaTemplate.instanceId = formulaInstances[0].id;
                angular.element(document.getElementById("instance-"+formulaTemplate.id)).addClass('highlightingElement');
            }
        }else{
            if(formulaInstances && formulaInstances.length >= 0) {
                formulaTemplate.instances = formulaInstances;
                me.$scope.formulaInstances = formulaInstances;
            }
        }
    },

    /*
    When configuring formulas, the code expects a list of either objects or strings.  If strings are provided, then
    they represent the names of the formulas that should be displayed for all cases.  An example is shown below:

        "formulas": ["formula1","formula2"]

    Otherwise, they should be objects with a required property of "name" and optional properties of "sourceKey" and
    "targetKey".  To limit a formula to a specific target, provide the targetKey and to limit the workflow to a
    specific source, provide the sourceKey.  "name" is the name of a formula.  An example is shown below:

        "formulas:" [
            {
                "name": "formula1",
                "sourceKey": "hubspot"
            },
            {
                "name": "formula2",
                "targetKey": "marketo"
            }
        ]
     */
    
    _filterFormulaTemplates: function(formulaTemplates) {
        var me = this;

        console.log("Filtering out formulas based on application configuration");

        var filteredFormulaTemplates = [];
        for(var i = 0; i < me._application.configuration.formulas.length; i++) {
            var formulaAppConfig = me._application.configuration.formulas[i];

            // look through each formula template we loaded and we have a formula template with the name in the formula app config, then include it
            if (typeof formulaAppConfig === 'string') {
                for(var j = 0; j < formulaTemplates.length; j++) {
                    var formulaTemplate = formulaTemplates[j];
                    if(formulaAppConfig === formulaTemplate.name) {
                        filteredFormulaTemplates.push(formulaTemplate);
                    }
                }
            }
            else {
                for(var j = 0; j < formulaTemplates.length; j++) {
                    var formulaTemplate = formulaTemplates[j];
                    if(formulaAppConfig.name === formulaTemplate.name) {
                        if (formulaAppConfig.sourceKey && formulaAppConfig.targetKey) {
                            if (formulaAppConfig.sourceKey === me._picker.selectedElementInstance.element.key &&
                                formulaAppConfig.targetKey === me._picker._target.elementKey) {
                                if(!me._cloudElementsUtils.isEmpty(formulaAppConfig.configuration)) {
                                    formulaTemplate.configuration = formulaAppConfig.configuration;
                                }
                                filteredFormulaTemplates.push(formulaTemplate);
                            }
                        }
                        else if (formulaAppConfig.sourceKey) {
                            if (formulaAppConfig.sourceKey === me._picker.selectedElementInstance.element.key) {
                                if(!me._cloudElementsUtils.isEmpty(formulaAppConfig.configuration)) {
                                    formulaTemplate.configuration = formulaAppConfig.configuration;
                                }
                                filteredFormulaTemplates.push(formulaTemplate);
                            }
                        }
                        else if (formulaAppConfig.targetKey) {
                            if (formulaAppConfig.targetKey === me._picker._target.elementKey) {
                                if(!me._cloudElementsUtils.isEmpty(formulaAppConfig.configuration)) {
                                    formulaTemplate.configuration = formulaAppConfig.configuration;
                                }
                                filteredFormulaTemplates.push(formulaTemplate);
                            }
                        }
                        else {
                            filteredFormulaTemplates.push(formulaTemplate);
                        }
                    }
                }
            }
        }
        me.$scope.formulas = filteredFormulaTemplates;
    },

    _onFormulaInstancesRefresh: function() {
        var me = this;
        console.log("Refreshing formula instances");
        me._highlightFormulaInstances();
    },

    refreshFormula: function(){
        var me = this;
        var indx = me.$scope.selectedFormula.indexOf(me.$scope.selectedFormula.selected);
        me._findMultipleFormulaInstances(indx);
    }
});

FormulaController.$inject = ['$scope', 'CloudElementsUtils', 'Application', 'Formula', 'FormulaInstance', 'Notifications', 'ElementsService', 'MaskLoader', 'Picker', '$window', '$location', '$interval', '$filter', '$route', '$mdDialog'];

angular.module('bulkloaderApp')
    .controller('FormulaController', FormulaController);
