/**
 * @file sales-data-source.js
 * @description Global Data Source Manager untuk Midnorth Portal.
 */

class GlobalDataSourceManager {
    constructor() {
        if (GlobalDataSourceManager.instance) {
            return GlobalDataSourceManager.instance;
        }
        
        this.currentMode = localStorage.getItem('midnorth_global_datasource_mode') || 'AUTO';
        this.activeSource = 'STORE_SUBMISSION';
        this.sourceMetadata = {
            STORE_SUBMISSION: {
                label: 'Store Submission',
                badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
                confidence: 85,
                statusText: 'Temporary',
                lastUpload: '-',
                uploadedBy: 'Store Personnel'
            },
            OFFICIAL_IT: {
                label: 'Official IT Report',
                badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                confidence: 100,
                statusText: 'Validated',
                lastUpload: '-',
                uploadedBy: 'IT Headquarters'
            }
        };
        
        GlobalDataSourceManager.instance = this;
    }

    setDataSourceMode(mode, availableMetadata = null) {
        this.currentMode = mode;
        localStorage.setItem('midnorth_global_datasource_mode', mode);

        if (availableMetadata) {
            if (availableMetadata.officialLastUpload) {
                this.sourceMetadata.OFFICIAL_IT.lastUpload = availableMetadata.officialLastUpload;
                this.sourceMetadata.OFFICIAL_IT.uploadedBy = availableMetadata.officialUploadedBy || 'System IT';
            }
            if (availableMetadata.submissionLastUpload) {
                this.sourceMetadata.STORE_SUBMISSION.lastUpload = availableMetadata.submissionLastUpload;
                this.sourceMetadata.STORE_SUBMISSION.uploadedBy = availableMetadata.submissionUploadedBy || 'Store Teams';
            }
        }

        if (mode === 'AUTO') {
            const hasOfficial = this.sourceMetadata.OFFICIAL_IT.lastUpload !== '-';
            this.activeSource = hasOfficial ? 'OFFICIAL_IT' : 'STORE_SUBMISSION';
        } else {
            this.activeSource = mode;
        }

        this.broadcastChange();
    }

    getActiveSourceInfo() {
        const meta = this.sourceMetadata[this.activeSource];
        return {
            mode: this.currentMode,
            activeSource: this.activeSource,
            label: meta.label,
            badgeClass: meta.badgeClass,
            confidence: `${meta.confidence}%`,
            statusText: meta.statusText,
            lastUpload: meta.lastUpload,
            uploadedBy: meta.uploadedBy
        };
    }

    broadcastChange() {
        const payload = this.getActiveSourceInfo();
        const event = new CustomEvent('midnorth:datasource-change', {
            detail: payload,
            bubbles: true
        });
        window.dispatchEvent(event);
        
        const bannerTitle = document.getElementById('global-source-label');
        if (bannerTitle) bannerTitle.textContent = payload.label;
    }
}

const dataSourceManager = new GlobalDataSourceManager();
export default dataSourceManager;
