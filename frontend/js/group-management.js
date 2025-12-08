function showGroupDetails(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const isAdmin = group.creatorId === appCurrentUser.id;
    
    let membersHtml = '<div class="group-members-list">';
    group.members.forEach(member => {
        const isMe = member.userId === appCurrentUser.id;
        const isCreator = member.userId === group.creatorId;
        
        membersHtml += `
            <div class="group-member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar-small" style="background-color: var(--accent-color);">${member.user.username.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <div style="font-weight: 500;">${member.user.username} ${isMe ? '(Vous)' : ''}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${isCreator ? 'Administrateur' : 'Membre'}</div>
                    </div>
                </div>
                ${isAdmin && !isMe ? `
                    <button onclick="removeGroupMember(${groupId}, ${member.userId})" class="btn-icon btn-trash" title="Retirer du groupe">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                ` : ''}
            </div>
        `;
    });
    membersHtml += '</div>';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>${group.name}</h3>
                <button id="close-group-modal" class="btn-icon btn-close"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4>Membres (${group.members.length})</h4>
                ${membersHtml}
            </div>

            <div class="modal-actions" style="flex-direction: column; gap: 10px;">
                ${isAdmin ? `
                    <button onclick="showAddMemberModal(${groupId})" class="btn-primary" style="width: 100%;">Ajouter un membre</button>
                ` : ''}
                <button onclick="leaveGroup(${groupId})" class="btn-secondary" style="width: 100%; color: var(--danger-color); border-color: var(--danger-color);">Quitter le groupe</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('close-group-modal').onclick = () => document.body.removeChild(modal);
}

function showAddMemberModal(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const currentMemberIds = group.members.map(m => m.userId);
    const availableFriends = friends.filter(f => {
        const friendId = f.sender.id === appCurrentUser.id ? f.receiver.id : f.sender.id;
        return !currentMemberIds.includes(friendId);
    });

    if (availableFriends.length === 0) {
        showToast('Tous vos amis sont déjà dans ce groupe', 'info');
        return;
    }

    let friendsHtml = '<div style="max-height: 300px; overflow-y: auto;">';
    availableFriends.forEach(friend => {
        const friendUser = friend.sender.id === appCurrentUser.id ? friend.receiver : friend.sender;
        friendsHtml += `
            <div class="friend-item" onclick="addGroupMember(${groupId}, ${friendUser.id})" style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; align-items: center; gap: 10px;">
                <div class="avatar-small" style="background-color: var(--accent-color);">${friendUser.username.substring(0, 2).toUpperCase()}</div>
                <span>${friendUser.username}</span>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-left: auto;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
        `;
    });
    friendsHtml += '</div>';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Ajouter un membre</h3>
                <button id="close-add-member" class="btn-icon btn-close"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            ${friendsHtml}
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('close-add-member').onclick = () => document.body.removeChild(modal);
}

async function addGroupMember(groupId, userId) {
    try {
        const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Membre ajouté !', 'success');
            document.querySelector('.modal-overlay[style*="z-index: 10000"]').remove();
            document.querySelector('.modal-overlay').remove();
            await loadGroups();
            showGroupDetails(groupId);
        } else {
            const error = await response.json();
            showToast(error.error, 'error');
        }
    } catch (error) {
        console.error('Erreur ajout membre:', error);
        showToast('Erreur lors de l\'ajout', 'error');
    }
}

function removeGroupMember(groupId, userId) {
    showConfirmModal('Retirer un membre', 'Voulez-vous vraiment retirer ce membre du groupe ?', async () => {
        try {
            const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            
            if (response.ok) {
                showToast('Membre retiré', 'success');
                const detailsModal = document.querySelector('.modal-overlay');
                if (detailsModal) detailsModal.remove();
                
                await loadGroups();
                showGroupDetails(groupId);
            } else {
                const error = await response.json();
                showToast(error.error, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression membre:', error);
            showToast('Erreur lors de la suppression', 'error');
        }
    });
}

window.leaveGroup = function(groupId) {
    showConfirmModal('Quitter le groupe', 'Voulez-vous vraiment quitter ce groupe ?', async () => {
        try {
            const response = await fetch(`/api/groups/${groupId}/leave`, {
                method: 'DELETE',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newCreatorId: null }), 
                credentials: 'include'
            });
            
            if (response.ok) {
                showToast('Vous avez quitté le groupe', 'success');
                
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(el => el.remove());
                
                currentConversation = null;
                document.getElementById('chat-area').style.display = 'none';
                document.getElementById('welcome-screen').style.display = 'flex';
                
                if (typeof resetChatHeader === 'function') {
                    resetChatHeader();
                }
                
                await loadGroups();
            } else {
                const error = await response.json();
                if (error.error === 'TRANSFER_REQUIRED') {
                    if (typeof showTransferModal === 'function' && error.members) {
                        showTransferModal(groupId, error.members);
                    } else {
                        showToast('En tant qu\'administrateur, vous devez désigner un nouveau créateur avant de partir.', 'error');
                    }
                } else {
                    showToast(error.error, 'error');
                }
            }
        } catch (error) {
            console.error('Erreur quitter groupe:', error);
            showToast('Erreur lors du départ du groupe', 'error');
        }
    });
};
