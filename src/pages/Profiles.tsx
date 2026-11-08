import { useState } from 'react';
import { Check, ChevronRight, Pencil, Plus, Settings, Trash2, Volume2, Waves } from 'lucide-react';
import type { Profile, Store } from '../domain/types';
import { createProfile } from '../domain/storage';
import { Modal } from '../components/Modal';
import { Flower } from '../components/Artwork';
export function Profiles({
  store,
  initialSettings,
  onChange,
  onClose,
}: {
  store: Store;
  initialSettings: boolean;
  onChange: (store: Store) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'list' | 'edit' | 'add' | 'settings' | 'delete'>(
    initialSettings ? 'settings' : 'list',
  );
  const [editingId, setEditingId] = useState(store.activeProfileId),
    [name, setName] = useState(''),
    [avatar, setAvatar] = useState(0);
  const active = store.profiles.find((p) => p.id === store.activeProfileId)!;
  const editing = store.profiles.find((p) => p.id === editingId) ?? active;
  function openEdit(profile: Profile) {
    setEditingId(profile.id);
    setName(profile.name);
    setAvatar(profile.avatar);
    setView('edit');
  }
  function save() {
    if (!name.trim()) return;
    if (view === 'add') {
      const profile = createProfile(name, avatar);
      onChange({ ...store, activeProfileId: profile.id, profiles: [...store.profiles, profile] });
    } else
      onChange({
        ...store,
        profiles: store.profiles.map((p) =>
          p.id === editingId ? { ...p, name: name.trim(), avatar } : p,
        ),
      });
    setView('list');
  }
  function toggle(key: 'sound' | 'reducedMotion') {
    onChange({
      ...store,
      profiles: store.profiles.map((p) =>
        p.id === active.id ? { ...p, settings: { ...p.settings, [key]: !p.settings[key] } } : p,
      ),
    });
  }
  const title =
    view === 'list'
      ? '我的小花园'
      : view === 'add'
        ? '欢迎新的小伙伴'
        : view === 'edit'
          ? '装扮我的档案'
          : view === 'delete'
            ? '确定告别这个花园？'
            : '让练习更合心意';
  return (
    <Modal title={title} onClose={onClose}>
      {view === 'list' ? (
        <>
          <p className="modal-copy">每个人，都有自己的成长花园。</p>
          <div className="profile-list">
            {store.profiles.map((p) => (
              <div className={`profile-row ${p.id === active.id ? 'active' : ''}`} key={p.id}>
                <button
                  className="profile-select"
                  onClick={() => {
                    onChange({ ...store, activeProfileId: p.id });
                    onClose();
                  }}
                  aria-label={`切换到${p.name}`}
                >
                  <span className="avatar">
                    <Flower variant={p.avatar} />
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.history.length} 次练习 · 独立记录</small>
                  </span>
                  {p.id === active.id && <Check size={20} />}
                </button>
                <button
                  className="icon-button"
                  onClick={() => openEdit(p)}
                  aria-label={`编辑${p.name}`}
                >
                  <Pencil size={17} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="add-profile"
            onClick={() => {
              setName('');
              setAvatar(0);
              setView('add');
            }}
          >
            <Plus size={20} />
            添加新档案
          </button>
          <button className="settings-link" onClick={() => setView('settings')}>
            <Settings size={18} />
            当前档案的偏好设置
            <ChevronRight size={17} />
          </button>
          <p className="local-note">数据只保存在这台设备的浏览器中。</p>
        </>
      ) : view === 'edit' || view === 'add' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field-label" htmlFor="profile-name">
            怎么称呼你？
          </label>
          <input
            autoFocus
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="给自己起个喜欢的名字"
            required
          />
          <span className="input-count">{name.length} / 12</span>
          <label className="field-label">选一朵属于你的小花</label>
          <div className="avatar-options">
            {[0, 1, 2, 3].map((n) => (
              <button
                type="button"
                key={n}
                className={avatar === n ? 'selected' : ''}
                onClick={() => setAvatar(n)}
                aria-pressed={avatar === n}
                aria-label={['向日葵', '绿芽花', '紫丁香', '小桃花'][n]}
              >
                <Flower variant={n} />
                {avatar === n && <Check size={17} />}
              </button>
            ))}
          </div>
          <button className="primary-button full-width" disabled={!name.trim()} type="submit">
            {view === 'add' ? '开启新花园' : '保存修改'}
            <Check size={18} />
          </button>
          {view === 'edit' && store.profiles.length > 1 && (
            <button type="button" className="delete-profile" onClick={() => setView('delete')}>
              <Trash2 size={16} />
              删除这个档案
            </button>
          )}
          <button className="text-button centered" type="button" onClick={() => setView('list')}>
            返回档案列表
          </button>
        </form>
      ) : view === 'delete' ? (
        <>
          <div className="delete-illustration">
            <Flower variant={editing.avatar} />
          </div>
          <p className="modal-copy">
            「{editing.name}」的当前练习、成就和设置将从这台设备的主记录中删除。应用还会删除
            这台浏览器中可能包含其他档案旧备份的整个本地旧版与恢复副本；其他档案的当前记录不会改变。
            已下载到应用外的原始文件不在应用控制范围内，需要你自行删除。
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setView('edit')}>
              保留花园
            </button>
            <button
              className="danger-button"
              onClick={() => {
                const profiles = store.profiles.filter((p) => p.id !== editingId);
                onChange({
                  ...store,
                  profiles,
                  activeProfileId:
                    store.activeProfileId === editingId ? profiles[0].id : store.activeProfileId,
                });
                setView('list');
              }}
            >
              确认删除
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="settings-profile">
            <span className="avatar">
              <Flower variant={active.avatar} />
            </span>
            <span>为「{active.name}」设置</span>
          </div>
          <button
            className="setting-row"
            onClick={() => toggle('sound')}
            aria-pressed={active.settings.sound}
          >
            <Volume2 size={23} />
            <span>
              <strong>轻快音效</strong>
              <small>答题时给你一点声音鼓励</small>
            </span>
            <i className={`switch ${active.settings.sound ? 'on' : ''}`} />
          </button>
          <button
            className="setting-row"
            onClick={() => toggle('reducedMotion')}
            aria-pressed={active.settings.reducedMotion}
          >
            <Waves size={23} />
            <span>
              <strong>舒缓动画</strong>
              <small>减少装饰动画与动态效果</small>
            </span>
            <i className={`switch ${active.settings.reducedMotion ? 'on' : ''}`} />
          </button>
          <p className="local-note">设置仅影响当前档案。浏览器系统的减少动态效果偏好始终有效。</p>
          <div className="about-card">
            <Flower variant={1} />
            <h3>脑力花园</h3>
            <p>每天一点，脑力开花。</p>
            <small>本地保存 · 无需账号 · 不含广告</small>
          </div>
          <button className="text-button centered" onClick={() => setView('list')}>
            管理我的档案
          </button>
        </>
      )}
    </Modal>
  );
}
