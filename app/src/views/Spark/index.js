"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Component = Component;
var react_1 = require("react");
var ui_1 = require("@ifrc-go/ui");
var react_router_dom_1 = require("react-router-dom");
var Page_1 = require("#components/Page");
var useRouting_1 = require("#hooks/useRouting");
var WorldMap_1 = require("./components/WorldMap");
var WarehouseStocksTable_1 = require("./WarehouseStocks/WarehouseStocksTable");
var ProBonoServicesTable_1 = require("./ProBonoServicesTable");
var CustomRegulationsMatrix_1 = require("./CustomRegulationsMatrix");
var styles_module_css_1 = require("./styles.module.css");
function Component() {
    var location = (0, react_router_dom_1.useLocation)();
    var navigate = (0, useRouting_1.default)().navigate;
    var _a = (0, react_1.useState)('spark-dashboard'), localActiveTab = _a[0], setLocalActiveTab = _a[1];
    var isFrameworkAgreementsRoute = location.pathname.startsWith('/spark/framework-agreements');
    var activeTab = isFrameworkAgreementsRoute
        ? 'framework-agreements'
        : localActiveTab;
    var handleTabChange = function (nextTab) {
        if (nextTab === 'framework-agreements') {
            navigate('sparkFrameworkAgreements');
            return;
        }
        // Keep the URL clean for non-routed tabs
        navigate('globalLogistics');
        setLocalActiveTab(nextTab);
    };
    return (<Page_1.default title="SPARK" heading="SPARK" description="Centralised Platform for Enhancing Emergency Supply Chain and Decision-Making">
            <div className={styles_module_css_1.default.tabsContainer}>
                <ui_1.Tabs value={activeTab} onChange={handleTabChange} styleVariant="tab">
                    <ui_1.TabList>
                        <ui_1.Tab name="spark-dashboard">SPARK Dashboard</ui_1.Tab>
                        <ui_1.Tab name="warehouse-stocks">Warehouse Stocks</ui_1.Tab>
                        <ui_1.Tab name="framework-agreements">Framework Agreements</ui_1.Tab>
                        <ui_1.Tab name="pro-bono-services">Pro Bono Services</ui_1.Tab>
                        <ui_1.Tab name="custom-regulations">Custom Regulations</ui_1.Tab>
                    </ui_1.TabList>

                    <ui_1.TabPanel name="spark-dashboard">
                        <div className={styles_module_css_1.default.tabContent}>
                            <div className={styles_module_css_1.default.placeholder}>
                                <h2 className={styles_module_css_1.default.placeholderTitle}>SPARK Dashboard</h2>
                                <p className={styles_module_css_1.default.placeholderText}>Overview map and dashboard widgets.</p>
                                <ui_1.Container>
                                    <WorldMap_1.default width={1200} height={600}/>
                                </ui_1.Container>
                            </div>
                        </div>
                    </ui_1.TabPanel>

                    <ui_1.TabPanel name="warehouse-stocks">
                        <div className={styles_module_css_1.default.tabContent}>
                            <WarehouseStocksTable_1.default />
                        </div>
                    </ui_1.TabPanel>

                    <ui_1.TabPanel name="framework-agreements">
                        <div className={styles_module_css_1.default.tabContent}>
                            <react_router_dom_1.Outlet />
                        </div>
                    </ui_1.TabPanel>

                    <ui_1.TabPanel name="pro-bono-services">
                        <div className={styles_module_css_1.default.tabContent}>
                            <ProBonoServicesTable_1.default />
                        </div>
                    </ui_1.TabPanel>

                    <ui_1.TabPanel name="custom-regulations">
                        <div className={styles_module_css_1.default.tabContent}>
                            <CustomRegulationsMatrix_1.default />
                        </div>
                    </ui_1.TabPanel>
                </ui_1.Tabs>
            </div>
        </Page_1.default>);
}
Component.displayName = 'Spark';
