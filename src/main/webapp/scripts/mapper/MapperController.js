/**
 * Datalist controller for selecting the fields.
 *
 *
 * @author Ramana
 */

var MapperController = BaseController.extend({

    _notifications: null,
    _cloudElementsUtils: null,
    _picker: null,
    _datalist: null,
    _mapper: null,
    _instances: null,
    _schedule: null,
    _maskLoader: null,

    init:function($scope, CloudElementsUtils, Picker, Datalist, Mapper, Notifications, Schedule, MaskLoader, $window, $location, $filter, $route){
        var me = this;

        me._notifications = Notifications;
        me._cloudElementsUtils = CloudElementsUtils;
        me._picker = Picker;
        me._datalist = Datalist;
        me._mapper = Mapper;
        me._schedule = Schedule;
        me.$window = $window;
        me.$location = $location;
        me._maskLoader = MaskLoader;
        me._super($scope);
    },

    defineScope:function() {
        var me = this;

        // This is for transitions
        me.$scope.pageClass = 'page-datalist';

        me.$scope.targetObjects = [];
        me.$scope.instanceObjects = [];
        me.$scope.selectedObject = {};
        me.$scope.selectedTargetObject = {};
        me.$scope.objectMetaData = [];
        me.$scope.mapperdata = [];
        me.$scope.cbObject = {};
        me.$scope.cbInstance = {};

        //Mapping of UI actions to methods to be invoked
        me.$scope.refreshObjectMetaData = me.refreshObjectMetaData.bind(this);
        me.$scope.refreshTargetObject = me.refreshTargetObject.bind(this);

        // Handling Booleans to display and hide UI
        me.$scope.showTree = false;

        //Handling Action Methods
        me.$scope.save = me.save.bind(this);
        me.$scope.cancel = me.cancel.bind(this);
        me.$scope.showTreeToggle = me.showTreeToggle.bind(this);
        me.$scope.toggle = this.toggle.bind(this);

        me.$scope.checkAllInstance = me.checkAllInstance.bind(this);
        me.$scope.checkAllObjects = me.checkAllObjects.bind(this);

        me.$scope.unCheckObject = me.unCheckObject.bind(this);
        me._seedMapper();
    },

    defineListeners:function(){
        var me = this;
        me._super();

        //Needed this for back and forth between datalist and Picker, if the datalist is reinitializes every time, this is not required
        //me._notifications.addEventListener(bulkloader.events.VIEW_CHANGE_DATALIST, me._seedMapper.bind(me));

        me._notifications.addEventListener(bulkloader.events.TRANSFORMATION_SAVED, me._onTransformationSave.bind(me));
        me._notifications.addEventListener(bulkloader.events.DATALIST_ERROR, me._onDatalistError.bind(me));

    },

    showTreeToggle: function(mapperdata) {
        var me = this;

        if(!me._cloudElementsUtils.isEmpty(mapperdata)
            && ((!me._cloudElementsUtils.isEmpty(mapperdata.fields)
                && mapperdata.fields.length > 0) || !me._datalist._isLiteral(mapperdata.type)))
            return true;
        else
            return false;
    },

    toggle: function(uitree) {
        uitree.toggle();
    },

    refreshObjectMetaData: function() {
        var me = this;

        me._maskLoader.show(me.$scope, "Loading Object ...");
        var instanceMeta = me._mapper.all[me._picker.selectedElementInstance.element.key].metadata;
        if(me._cloudElementsUtils.isEmpty(instanceMeta)
            || me._cloudElementsUtils.isEmpty(instanceMeta[me.$scope.selectedObject.select.name])) {

            me._mapper.loadObjectMetaData(me._picker.selectedElementInstance, me.$scope.selectedObject.select.name)
                .then(me._handleOnMetadataLoad.bind(me, me.$scope.selectedObject));
        } else {
            me._handleOnMetadataLoad(me.$scope.selectedObject, instanceMeta[me.$scope.selectedObject.select.name]);
        }
    },

    _handleOnMetadataLoad: function(obj,data) {
        var me = this;
        me.$scope.objectMetaData = data.fields;
        me.$scope.showTree = true;

        //TODO
        //Now Check to see if there is a mapping already exists for the object
        //if so just set the target mapper

        me._maskLoader.hide();
    },


    refreshTargetObject: function() {
        var me = this;

        me._maskLoader.show(me.$scope, "Loading mapping...");

        var targetMetaMapping = me._mapper.all[me._picker.targetElementInstance.element.key].metamapping;
        if(me._cloudElementsUtils.isEmpty(targetMetaMapping)
            || me._cloudElementsUtils.isEmpty(targetMetaMapping[me.$scope.selectedTargetObject])) {

            me._mapper.loadTargetObjectMetaMapping(me._picker.targetElementInstance, me.$scope.selectedTargetObject)
                .then(me._handleOnTargetMetamappingLoad.bind(me, me.$scope.selectedTargetObject));
        } else {
            me._handleOnTargetMetamappingLoad(me.$scope.selectedTargetObject, instanceMeta[me.$scope.selectedTargetObject]);
        }

    },

    _handleOnTargetMetamappingLoad: function(obj, data) {
        var me = this;

        me.$scope.mapperdata = data.fields;
        me.$scope.showTree = true;
        me._maskLoader.hide();
    },

    _seedMapper: function() {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me._picker.selectedElementInstance)
            || me._cloudElementsUtils.isEmpty(me._picker.targetElementInstance)) {

            me.$location.path('/');
            return;
        }

        me._maskLoader.show(me.$scope, 'Loading Objects...');

        //Load the objects for the element
        me._mapper.loadInstanceObjects(me._picker.selectedElementInstance, me._picker.targetElementInstance)
            .then(me._handleOnInstanceObjectsLoad.bind(me));

    },

    _handleOnInstanceObjectsLoad: function(data) {
        var me = this;

        me.$scope.instanceObjects = data;
        me.$scope.targetObjects = me._mapper.all[me._picker.targetElementInstance.element.key].objects;
        me.$scope.selectedObject.select = me.$scope.instanceObjects[0];
        me.refreshObjectMetaData(me.$scope.selectedObject.select.name);
    },

    cancel: function() {
        var me = this;
        me.$location.path('/');
    },

    save: function() {
        var me = this;
        me._maskLoader.show(me.$scope, 'Saving...');
        var saveStatus = me._datalist.saveDefinitionAndTransformation(me._picker.selectedElementInstance, me.$scope.instanceObjects);

    },

    _onTransformationSave: function() {
        //Show the scheduler
        var me = this;
        me._maskLoader.hide();
        //me._notifications.notify(bulkloader.events.SHOW_SCHEDULER);
        me._schedule.openSchedule();
    },

    _onDatalistError: function() {
        var me = this;
    },

    checkAllInstance: function(cbState, cbObject) {
        var me = this;
        for (var i = 0; i < me.$scope.objectMetaData.length; i++) {
            me.$scope.objectMetaData[i].transform = cbState;
            if(me.$scope.objectMetaData[i].type == "object" || me.$scope.objectMetaData[i].type == "array"){
                var obj = me.$scope.objectMetaData[i].fields;
                for(var metadata in obj){
                    var metoo = obj[metadata];
                    metoo.transform = cbState;
                }
            }
        }
    },

    unCheckObject: function(cbState, metadata, obj){
        var me = this;
        var o = obj.length;
        var ownerData;

        while(o--) {
            var n = metadata.actualVendorPath.indexOf(".");
            if(metadata.actualVendorPath.slice(0,n) == obj[o].vendorPath || metadata.actualVendorPath == obj[o].vendorPath) {
                ownerData = obj[o];
                break;
            }
        }

        if(metadata.type == "object" || metadata.type == "array") {
            for (var i = 0; i < metadata.fields.length; i++) {
                metadata.fields[i].transform = cbState;
                if(ownerData.type == "object" && cbState == false){
                    ownerData.transform = cbState;
                }
            }
        }else{
            metadata.transform = cbState;
            if(cbState == false){
                ownerData.transform = cbState;
                me.$scope.cbObject.checked = cbState;
            }
        }
    },

    checkAllObjects: function(cbState, cbObject) {
        var me = this;
        for (var i = 0; i < me.$scope.instanceObjects.length; i++) {
            me.$scope.instanceObjects[i].transformed = cbState;
        }
    }
});

MapperController.$inject = ['$scope','CloudElementsUtils','Picker', 'Datalist', 'Mapper', 'Notifications', 'Schedule', 'MaskLoader', '$window', '$location', '$filter', '$route'];


angular.module('bulkloaderApp')
    .controller('MapperController', MapperController);