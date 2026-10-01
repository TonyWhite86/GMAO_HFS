import { supabase } from '../lib/supabase';
import { Skill, UserSkill, PaginationParams } from '../types';
import { mapSkill, mapUserSkill } from '../utils/mappers';

export const skillsService = {
    // --- Skills Definition ---

    async getSkills(pagination?: PaginationParams): Promise<Skill[]> {
        let query = supabase
            .from('skills')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;

        if (error) {
            console.error('Error fetching skills:', error);
            throw error;
        }
        return (data || []).map(mapSkill);
    },

    async addSkill(skill: Omit<Skill, 'id' | 'createdAt'>): Promise<Skill> {
        const { data, error } = await supabase
            .from('skills')
            .insert([{
                name: skill.name,
                description: skill.description,
                category: skill.category
            }])
            .select()
            .single();

        if (error) throw error;
        return mapSkill(data);
    },

    async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill> {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.category !== undefined) dbUpdates.category = updates.category;

        const { data, error } = await supabase
            .from('skills')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapSkill(data);
    },

    async deleteSkill(id: string): Promise<void> {
        const { error } = await supabase
            .from('skills')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- User Skills (Matrix) ---

    async getAllUserSkills(pagination?: PaginationParams): Promise<UserSkill[]> {
        let query = supabase
            .from('user_skills')
            .select('*');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;

        if (error) {
            console.error('Error fetching user skills:', error);
            throw error;
        }
        return (data || []).map(mapUserSkill);
    },

    async getUserSkills(userId: string): Promise<UserSkill[]> {
        const { data, error } = await supabase
            .from('user_skills')
            .select('*, skill:skills(*)')
            .eq('user_id', userId);

        if (error) throw error;
        return (data || []).map(mapUserSkill);
    },

    async updateUserSkill(userId: string, skillId: string, level: number): Promise<UserSkill> {
        const { data: existing } = await supabase
            .from('user_skills')
            .select('id')
            .eq('user_id', userId)
            .eq('skill_id', skillId)
            .maybeSingle();

        let result;
        if (existing) {
            const { data, error } = await supabase
                .from('user_skills')
                .update({ level })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from('user_skills')
                .insert({
                    user_id: userId,
                    skill_id: skillId,
                    level,
                    validation_date: new Date().toISOString()
                })
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        return mapUserSkill(result);
    },

    async deleteUserSkill(userId: string, skillId: string): Promise<void> {
        const { error } = await supabase
            .from('user_skills')
            .delete()
            .match({ user_id: userId, skill_id: skillId });

        if (error) throw error;
    }
};
